import { describe, expect, it } from '@jest/globals';
import { blankEvent, blankEventDate } from '@/domain/defaults';
import type { Booking, Campaign, Contact } from '@/domain/types';
import { resolveAudience, renderMergeTags, smsSegments } from '@/lib/campaign';
import { checkCapacity, resolveStatusForCapacity } from '@/lib/capacity';
import { blankContact, findContact, mergeContacts, normPhone, syncBooking } from '@/lib/crmSync';
import { BOOKING_REF_PATTERN, newBookingRef } from '@/lib/ids';
import { enforceFreeEvent, quote } from '@/lib/pricing';
import { can, ROLE_PERMISSIONS } from '@/lib/rbac';
import { buildContext, evaluate } from '@/lib/segments/evaluate';
import { detailChips } from '@/lib/auditFormat';

const NOW = '2026-10-19T10:00:00.000Z';

function event(price = 100, capacity = 10) {
  const e = blankEvent(NOW);
  e.id = 'ev1';
  e.price = price;
  e.capacity = capacity;
  e.dates = [{ ...blankEventDate(), id: 'd1', date: '2026-11-01', maxRegistrations: 3 }, { ...blankEventDate(), id: 'd2', date: '2026-11-08', sessionPrice: 80 }];
  return e;
}

function booking(p: Partial<Booking> = {}): Booking {
  return {
    id: Math.random().toString(36),
    ref: 'BK-2026-AAAAAA',
    eventId: 'ev1',
    eventDateId: 'd1',
    customer: { fullName: 'Ama Mensah', email: 'ama@x.com', phone: '0241234567', occupation: '', company: 'MTN', role: '' },
    heardAbout: '',
    attendees: 1,
    discountCode: '',
    discountLabel: '',
    discountAmount: 0,
    amountPaid: 100,
    total: 100,
    currency: 'GHS',
    status: 'confirmed',
    paymentStatus: 'completed',
    paymentMethod: 'paystack',
    transactionRef: '',
    specialRequirements: '',
    internalNotes: '',
    tags: [],
    source: 'Website',
    checkedIn: false,
    emailsSent: 0,
    smsSent: 0,
    createdAt: NOW,
    ...p,
  };
}

describe('booking ref', () => {
  it('matches BK-YYYY-XXXXXX and avoids collisions', () => {
    const taken = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const r = newBookingRef(taken, 2026);
      expect(r).toMatch(BOOKING_REF_PATTERN);
      expect(taken.has(r)).toBe(false);
      taken.add(r);
    }
  });
});

describe('pricing', () => {
  it('total = price × attendees − discount', () => {
    const q = quote(event(100), 3, null, { code: 'X', label: 'Early Bird', type: 'percent', value: 10, active: true });
    expect(q.subtotal).toBe(300);
    expect(q.discountAmount).toBe(30);
    expect(q.total).toBe(270);
    expect(q.discountLabel).toBe('Early Bird');
  });
  it('uses session price override', () => {
    expect(quote(event(100), 2, 'd2').total).toBe(160);
  });
  it('never goes below zero and respects allowDiscounts', () => {
    const e = event(100);
    expect(quote(e, 1, null, { code: 'X', label: 'x', type: 'fixed', value: 500, active: true }).total).toBe(0);
    e.options.allowDiscounts = false;
    expect(quote(e, 1, null, { code: 'X', label: 'x', type: 'fixed', value: 50, active: true }).total).toBe(100);
  });
  it('free events force not_required / free', () => {
    expect(enforceFreeEvent(true, 'completed', 'card')).toEqual({ paymentStatus: 'not_required', paymentMethod: 'free' });
    expect(enforceFreeEvent(false, 'pending', 'card')).toEqual({ paymentStatus: 'pending', paymentMethod: 'card' });
  });
});

describe('capacity', () => {
  it('uses date maxRegistrations, else event capacity; waitlist when full unless overridden', () => {
    const e = event(100, 10);
    const bs = [booking({ attendees: 2 }), booking({ attendees: 1, status: 'cancelled' }), booking({ attendees: 1, status: 'waitlist' })];
    const c = checkCapacity(e, bs, 2, 'd1');
    expect(c).toMatchObject({ capacity: 3, taken: 2, remaining: 1, fits: false });
    expect(resolveStatusForCapacity('confirmed', c, false)).toBe('waitlist');
    expect(resolveStatusForCapacity('confirmed', c, true)).toBe('confirmed');
    expect(resolveStatusForCapacity('cancelled', c, false)).toBe('cancelled');
    expect(checkCapacity(e, bs, 5, 'd2')).toMatchObject({ capacity: 10, fits: true });
  });
  it('excludes the booking being moved', () => {
    const e = event(100, 10);
    const b = booking({ attendees: 3 });
    expect(checkCapacity(e, [b], 3, 'd1', b.id).fits).toBe(true);
  });
});

describe('rbac', () => {
  it('maps roles to permissions', () => {
    const viewer = { role: 'viewer' as const, status: 'active' as const };
    expect(can(viewer, 'read:bookings')).toBe(true);
    expect(can(viewer, 'write:bookings')).toBe(false);
    expect(can({ role: 'content_manager', status: 'active' }, 'write:users')).toBe(false);
    expect(can({ role: 'admin', status: 'disabled' }, 'read:events')).toBe(false);
    expect(ROLE_PERMISSIONS.admin).toContain('manage:system');
  });
});

describe('crm sync', () => {
  it('normalises Ghana phones', () => {
    expect(normPhone('024 123 4567')).toBe('+233241234567');
    expect(normPhone('+233 24 123 4567')).toBe('+233241234567');
  });
  it('matches on email, then phone', () => {
    const a = blankContact(NOW, { id: 'a', email: 'A@x.com' });
    const b = blankContact(NOW, { id: 'b', phone: '+233241234567' });
    expect(findContact([a, b], 'a@x.com', '')?.id).toBe('a');
    expect(findContact([a, b], 'other@x.com', '0241234567')?.id).toBe('b');
  });
  it('creates a contact and converts to customer on first paid booking', () => {
    const b = booking();
    const r = syncBooking([], b, { title: 'AI 101' }, [b], NOW);
    expect(r.created).toBe(true);
    expect(r.contact.lifecycleStage).toBe('customer');
    expect(r.contact.totalSpent).toEqual([{ amount: 100, currency: 'GHS' }]);
    expect(r.activities.map((a) => a.type)).toEqual(['created', 'lifecycle', 'booking']);
  });
  it('merge keeps every activity and sums revenue', () => {
    const p = blankContact(NOW, { id: 'p', email: 'p@x.com', totalSpent: [{ amount: 100, currency: 'GHS' }], paidBookingsCount: 1 });
    const d = blankContact('2026-10-19T11:00:00.000Z', { id: 'd', fullName: 'Newer Name', totalSpent: [{ amount: 50, currency: 'GHS' }], paidBookingsCount: 1 });
    d.updatedAt = '2026-10-19T11:00:00.000Z';
    const acts = [{ id: '1', contactId: 'p', type: 'note' as const, source: '', summary: '', at: NOW }, { id: '2', contactId: 'd', type: 'note' as const, source: '', summary: '', at: NOW }];
    const r = mergeContacts(p, d, acts, NOW);
    expect(r.contact.totalSpent[0]!.amount).toBe(150);
    expect(r.contact.paidBookingsCount).toBe(2);
    expect(r.contact.fullName).toBe('Newer Name');
    expect(r.contact.email).toBe('p@x.com');
    expect(r.activities.filter((a) => a.contactId === 'p')).toHaveLength(3);
  });
});

describe('segment evaluator', () => {
  const c1 = blankContact(NOW, { id: 'c1', fullName: 'Kofi', email: 'kofi@mtn.com', tags: ['vip'], paidBookingsCount: 2, lifecycleStage: 'customer', lastActivityAt: '2026-01-01T00:00:00Z' });
  const c2 = blankContact(NOW, { id: 'c2', fullName: 'Esi', email: 'esi@gmail.com', emailOptOut: true, lastActivityAt: NOW });
  const ctx = buildContext([booking({ customer: { ...booking().customer, email: 'kofi@mtn.com' }, paymentStatus: 'pending' })], [], [], Date.parse(NOW));
  const g = (op: 'and' | 'or', children: any[]) => ({ kind: 'group' as const, id: 'g', op, children });
  const c = (field: string, operator: string, value?: unknown) => ({ kind: 'condition' as const, id: field + operator, field, operator, value });

  it('text ends_with for company domains', () => {
    expect(evaluate(g('and', [c('email', 'ends_with', '@mtn.com')]), c1, ctx)).toBe(true);
    expect(evaluate(g('and', [c('email', 'ends_with', '@mtn.com')]), c2, ctx)).toBe(false);
  });
  it('AND / OR and nested groups', () => {
    const rule = g('or', [c('tags', 'has_any', ['vip']), g('and', [c('emailStatus', 'is', ['opted_out'])])]);
    expect(evaluate(rule, c1, ctx)).toBe(true);
    expect(evaluate(rule, c2, ctx)).toBe(true);
    expect(evaluate(g('and', [c('tags', 'has_any', ['vip']), c('paidBookingsCount', 'gte', 3)]), c1, ctx)).toBe(false);
  });
  it('date windows and event booking sub-filters', () => {
    expect(evaluate(g('and', [c('lastActivityAt', 'not_in_last_days', 90)]), c1, ctx)).toBe(true);
    expect(evaluate(g('and', [c('lastActivityAt', 'not_in_last_days', 90)]), c2, ctx)).toBe(false);
    expect(evaluate(g('and', [c('eventBooking', 'has_booked', { eventIds: ['ev1'], paymentStatuses: ['pending'] })]), c1, ctx)).toBe(true);
    expect(evaluate(g('and', [c('eventBooking', 'has_booked', { eventIds: ['ev1'], paymentStatuses: ['completed'] })]), c1, ctx)).toBe(false);
  });
  it('incomplete conditions match everyone', () => {
    expect(evaluate(g('and', [c('fullName', 'contains', '')]), c2, ctx)).toBe(true);
  });
  it('segment membership with cycle guard', () => {
    const segs = [{ id: 's1', name: '', description: '', type: 'rules' as const, rules: g('and', [c('segment', 'in', ['s1'])]), contactIds: [], updatedAt: NOW }];
    const ctx2 = buildContext([], [], segs, Date.parse(NOW));
    expect(evaluate(g('and', [c('segment', 'in', ['s1'])]), c1, ctx2)).toBe(false);
  });
});

describe('campaign audience', () => {
  const base: Campaign['audience'] = { segmentIds: [], conditions: null, excludeSegmentIds: [], contactIds: [], includeOptedOut: false };
  const contacts: Contact[] = [
    blankContact(NOW, { id: 'a', fullName: 'Ama Mensah', email: 'a@x.com', phone: '+233241234567' }),
    blankContact(NOW, { id: 'b', email: 'b@x.com', emailOptOut: true, phone: '+2348012345678' }),
    blankContact(NOW, { id: 'c', email: 'A@x.com' }),
    blankContact(NOW, { id: 'd', phone: '' }),
  ];
  const ctx = buildContext([], [], [], Date.parse(NOW));
  it('email excludes opted-out unless ticked, dedupes, counts missing', () => {
    const r = resolveAudience(contacts, ctx, base, 'email');
    expect(r.recipients.map((x) => x.id)).toEqual(['a']);
    expect(r).toMatchObject({ optedOut: 1, duplicates: 1, missingAddress: 1 });
    expect(resolveAudience(contacts, ctx, { ...base, includeOptedOut: true }, 'email').recipients).toHaveLength(2);
  });
  it('sms only to Ghana numbers', () => {
    const r = resolveAudience(contacts, ctx, base, 'sms');
    expect(r.recipients.map((x) => x.id)).toEqual(['a']);
    expect(r.invalidNumber).toBe(1);
  });
  it('merge tags and segments', () => {
    expect(renderMergeTags('Hi {{firstName}} {{lastName}} at {{company}} {{unknown}}', { fullName: 'Ama Esi Mensah', company: 'MTN' })).toBe(
      'Hi Ama Esi Mensah at MTN {{unknown}}',
    );
    expect(smsSegments('x'.repeat(161))).toBe(2);
  });
});

describe('audit details', () => {
  it('never prints [object Object]', () => {
    const chips = detailChips({ filters: { status: 'confirmed', event: 'AI for Business Growth' }, resultCount: 3 });
    expect(chips).toEqual(['status = confirmed', 'event = AI for Business Growth', 'resultCount = 3']);
    expect(chips.join(' ')).not.toContain('[object Object]');
  });
});

describe('booking filters', () => {
  const { filterBookings, duplicateIds, DEFAULT_BOOKING_FILTERS } = require('@/lib/bookingFilters') as typeof import('@/lib/bookingFilters');
  const e = event();
  const list = [
    booking({ id: 'x1', ref: 'BK-2026-AAA111', status: 'confirmed', paymentStatus: 'completed', createdAt: '2026-10-01T10:00:00Z' }),
    booking({ id: 'x2', ref: 'BK-2026-BBB222', status: 'pending', paymentStatus: 'pending', createdAt: '2026-10-10T10:00:00Z', customer: { ...booking().customer, fullName: 'Kofi Owusu', email: 'kofi@x.com' } }),
    booking({ id: 'x3', ref: 'BK-2026-CCC333', status: 'confirmed', paymentStatus: 'pending', createdAt: '2026-10-15T10:00:00Z' }),
  ];
  it('combines filters with AND', () => {
    const r = filterBookings(list, [e], { ...DEFAULT_BOOKING_FILTERS, status: 'confirmed', paymentStatus: 'pending' });
    expect(r.map((b) => b.id)).toEqual(['x3']);
  });
  it('searches name, email and ref; filters by created date', () => {
    expect(filterBookings(list, [e], { ...DEFAULT_BOOKING_FILTERS, q: 'kofi' }).map((b) => b.id)).toEqual(['x2']);
    expect(filterBookings(list, [e], { ...DEFAULT_BOOKING_FILTERS, q: 'ccc333' }).map((b) => b.id)).toEqual(['x3']);
    expect(filterBookings(list, [e], { ...DEFAULT_BOOKING_FILTERS, startDate: '2026-10-05', endDate: '2026-10-12' }).map((b) => b.id)).toEqual(['x2']);
  });
  it('flags duplicate registrations (same email, same event)', () => {
    expect([...duplicateIds(list)].sort()).toEqual(['x1', 'x3']);
  });
});
