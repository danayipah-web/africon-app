import type { Booking, Condition, ConditionGroup, Contact, ContactActivity, Segment } from '@/domain/types';
import { newId } from '@/lib/ids';
import { fieldDef, OPERATORS, VALUELESS_OPERATORS } from './fields';

/** Sub-filters for the Event booking condition ("Narrow by", spec §6.2). */
export interface EventBookingValue {
  eventIds: string[];
  paymentStatuses?: string[];
  bookingStatuses?: string[];
  attendance?: ('checked_in' | 'not_checked_in')[];
  bookedAfter?: string;
  bookedBefore?: string;
  minTimes?: number;
}

export interface EvalContext {
  now: number;
  bookingsByEmail: Map<string, Booking[]>;
  activitiesByContact: Map<string, ContactActivity[]>;
  segments: Segment[];
  /** Internal: segment ids on the current evaluation path, to stop cycles. */
  visiting?: Set<string>;
}

const DAY = 24 * 60 * 60 * 1000;

export function emptyGroup(op: 'and' | 'or' = 'and'): ConditionGroup {
  return { kind: 'group', id: newId(), op, children: [] };
}

export function newCondition(field: string): Condition {
  const def = fieldDef(field);
  const operator = def ? OPERATORS[def.type][0]!.value : 'is';
  let value: unknown = undefined;
  if (def?.type === 'event_booking') value = { eventIds: [] } satisfies EventBookingValue;
  if (def?.type === 'enum' || def?.type === 'tags' || def?.type === 'sources' || def?.type === 'segment') value = [];
  return { kind: 'condition', id: newId(), field, operator, value };
}

export function buildContext(
  bookings: Booking[],
  activities: ContactActivity[],
  segments: Segment[],
  now = Date.now(),
): EvalContext {
  const bookingsByEmail = new Map<string, Booking[]>();
  for (const b of bookings) {
    const k = b.customer.email.trim().toLowerCase();
    if (!k) continue;
    const list = bookingsByEmail.get(k);
    if (list) list.push(b);
    else bookingsByEmail.set(k, [b]);
  }
  const activitiesByContact = new Map<string, ContactActivity[]>();
  for (const a of activities) {
    const list = activitiesByContact.get(a.contactId);
    if (list) list.push(a);
    else activitiesByContact.set(a.contactId, [a]);
  }
  return { now, bookingsByEmail, activitiesByContact, segments };
}

/** True when the condition has enough input to be applied. Incomplete conditions match everyone. */
export function isComplete(c: Condition) {
  if (VALUELESS_OPERATORS.has(c.operator)) return true;
  const def = fieldDef(c.field);
  if (!def) return false;
  const v = c.value;
  if (def.type === 'event_booking') return true;
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && String(v).trim() !== '';
}

export function evaluate(node: Condition | ConditionGroup, contact: Contact, ctx: EvalContext): boolean {
  if (node.kind === 'group') {
    const active = node.children.filter((c) => c.kind === 'group' || isComplete(c));
    if (active.length === 0) return true;
    return node.op === 'and'
      ? active.every((c) => evaluate(c, contact, ctx))
      : active.some((c) => evaluate(c, contact, ctx));
  }
  if (!isComplete(node)) return true;
  return evalCondition(node, contact, ctx);
}

export function matchContacts(rules: ConditionGroup, contacts: Contact[], ctx: EvalContext) {
  return contacts.filter((c) => evaluate(rules, c, ctx));
}

export function segmentMembers(segment: Segment, contacts: Contact[], ctx: EvalContext): Contact[] {
  if (segment.type === 'fixed') {
    const ids = new Set(segment.contactIds);
    return contacts.filter((c) => ids.has(c.id));
  }
  return matchContacts(segment.rules, contacts, ctx);
}

function isInSegment(segmentId: string, contact: Contact, ctx: EvalContext): boolean {
  const seg = ctx.segments.find((s) => s.id === segmentId);
  if (!seg) return false;
  if (seg.type === 'fixed') return seg.contactIds.includes(contact.id);
  const visiting = ctx.visiting ?? new Set<string>();
  if (visiting.has(segmentId)) return false; // cycle guard
  visiting.add(segmentId);
  const res = evaluate(seg.rules, contact, { ...ctx, visiting });
  visiting.delete(segmentId);
  return res;
}

const lc = (s: unknown) => String(s ?? '').trim().toLowerCase();
const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '');
const asArray = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v == null || v === '' ? [] : [String(v)]);

function evalText(actual: string, op: string, value: unknown, normalise: (s: unknown) => string = lc) {
  const a = normalise(actual);
  const v = normalise(value);
  switch (op) {
    case 'contains':
      return a.includes(v);
    case 'not_contains':
      return !a.includes(v);
    case 'is':
      return a === v;
    case 'is_not':
      return a !== v;
    case 'starts_with':
      return a.startsWith(v);
    case 'ends_with':
      return a.endsWith(v);
    case 'is_empty':
      return a === '';
    case 'is_not_empty':
      return a !== '';
    default:
      return true;
  }
}

function evalNumber(actual: number, op: string, value: unknown) {
  const v = Number(value);
  if (Number.isNaN(v)) return true;
  switch (op) {
    case 'gte':
      return actual >= v;
    case 'lte':
      return actual <= v;
    case 'eq':
      return actual === v;
    case 'gt':
      return actual > v;
    case 'lt':
      return actual < v;
    default:
      return true;
  }
}

function evalDate(actual: string | null, op: string, value: unknown, now: number) {
  const t = actual ? new Date(actual).getTime() : NaN;
  switch (op) {
    case 'is_empty':
      return Number.isNaN(t);
    case 'is_not_empty':
      return !Number.isNaN(t);
    case 'in_last_days':
      return !Number.isNaN(t) && t >= now - Number(value) * DAY;
    case 'not_in_last_days':
      return Number.isNaN(t) || t < now - Number(value) * DAY;
    case 'before':
      return !Number.isNaN(t) && t < new Date(String(value)).getTime();
    case 'after':
      return !Number.isNaN(t) && t > new Date(String(value)).getTime();
    default:
      return true;
  }
}

function totalSpentGhs(c: Contact) {
  return c.totalSpent.filter((m) => m.currency === 'GHS').reduce((s, m) => s + m.amount, 0);
}

function evalEventBooking(c: Contact, op: string, raw: unknown, ctx: EvalContext) {
  const v = (raw ?? { eventIds: [] }) as EventBookingValue;
  const list = (ctx.bookingsByEmail.get(lc(c.email)) ?? []).filter((b) => {
    if (v.eventIds?.length && !v.eventIds.includes(b.eventId)) return false;
    if (v.paymentStatuses?.length && !v.paymentStatuses.includes(b.paymentStatus)) return false;
    if (v.bookingStatuses?.length && !v.bookingStatuses.includes(b.status)) return false;
    if (v.attendance?.length) {
      const att = b.checkedIn ? 'checked_in' : 'not_checked_in';
      if (!v.attendance.includes(att)) return false;
    }
    if (v.bookedAfter && b.createdAt < v.bookedAfter) return false;
    if (v.bookedBefore && b.createdAt > v.bookedBefore) return false;
    return true;
  });
  const enough = list.length >= Math.max(1, v.minTimes ?? 1);
  return op === 'has_booked' ? enough : !enough;
}

function evalCondition(cond: Condition, c: Contact, ctx: EvalContext): boolean {
  const def = fieldDef(cond.field);
  if (!def) return true;
  const { operator: op, value } = cond;

  switch (def.type) {
    case 'text':
      return evalText((c as unknown as Record<string, string>)[def.key] ?? '', op, value);
    case 'phone':
      return evalText(c.phone, op, value, digits);
    case 'number': {
      const actual =
        def.key === 'totalSpent' ? totalSpentGhs(c) : Number((c as unknown as Record<string, number>)[def.key] ?? 0);
      return evalNumber(actual, op, value);
    }
    case 'date':
      return evalDate((c as unknown as Record<string, string | null>)[def.key] ?? null, op, value, ctx.now);
    case 'bool': {
      const actual = !!(c as unknown as Record<string, boolean>)[def.key];
      return op === 'is_true' ? actual : !actual;
    }
    case 'enum': {
      let actual: string;
      if (def.key === 'emailStatus') actual = !c.email ? 'no_email' : c.emailOptOut ? 'opted_out' : 'can_receive';
      else if (def.key === 'smsStatus') actual = !c.phone ? 'no_phone' : c.smsOptOut ? 'opted_out' : 'can_receive';
      else actual = String((c as unknown as Record<string, unknown>)[def.key] ?? '');
      const wanted = asArray(value);
      return op === 'is' ? wanted.includes(actual) : !wanted.includes(actual);
    }
    case 'tags':
    case 'sources': {
      const have = new Set((def.type === 'tags' ? c.tags : c.sources).map(lc));
      const wanted = asArray(value).map(lc);
      if (op === 'has_any') return wanted.some((w) => have.has(w));
      if (op === 'has_all') return wanted.every((w) => have.has(w));
      return !wanted.some((w) => have.has(w));
    }
    case 'activity': {
      const has = c.sources.includes(def.activitySource!);
      return op === 'has' ? has : !has;
    }
    case 'event_booking':
      return evalEventBooking(c, op, value, ctx);
    case 'campaign': {
      const ids = asArray(value);
      const acts = ctx.activitiesByContact.get(c.id) ?? [];
      const sent = acts.some((a) => (a.type === 'email' || a.type === 'sms') && ids.some((id) => a.source === `campaign:${id}`));
      return op === 'was_sent' ? sent : !sent;
    }
    case 'segment': {
      const ids = asArray(value);
      const inAny = ids.some((id) => isInSegment(id, c, ctx));
      return op === 'in' ? inAny : !inAny;
    }
  }
}

/** Contacts that can actually receive a channel. */
export function canReceiveEmail(c: Contact) {
  return !!c.email && !c.emailOptOut;
}
export function canReceiveSms(c: Contact) {
  return isGhanaMobile(c.phone) && !c.smsOptOut;
}

/** mNotify only delivers to Ghana numbers: +233 followed by 9 digits (or local 0XXXXXXXXX). */
export function isGhanaMobile(phone: string) {
  const d = digits(phone);
  return /^233\d{9}$/.test(d) || /^0\d{9}$/.test(d);
}
