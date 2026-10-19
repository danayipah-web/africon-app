import { currentUser } from '@/auth/session';
import { db } from '@/data/db';
import { bookingFormSchema, type BookingForm } from '@/domain/schemas';
import type { Booking, BookingStatus } from '@/domain/types';
import { checkCapacity, resolveStatusForCapacity } from '@/lib/capacity';
import { normEmail, syncBooking } from '@/lib/crmSync';
import { newBookingRef, newId } from '@/lib/ids';
import { enforceFreeEvent, findDiscount, quote } from '@/lib/pricing';
import { assertCan } from '@/lib/rbac';
import { logAudit } from './audit';

export class CapacityError extends Error {
  constructor(public remaining: number, public capacity: number) {
    super(`Only ${remaining} of ${capacity} places are left. Confirm to override, or the booking goes on the waitlist.`);
    this.name = 'CapacityError';
  }
}

/** Upsert the CRM contact for a booking (spec §5.6: every booking upserts a contact). */
function syncCrm(booking: Booking) {
  const s = db.get();
  const ev = s.events.find((e) => e.id === booking.eventId);
  const email = normEmail(booking.customer.email);
  const forEmail = s.bookings.filter((b) => normEmail(b.customer.email) === email);
  const res = syncBooking(s.contacts, booking, ev, forEmail, new Date().toISOString());
  db.set((st) => ({
    contacts: res.created ? [...st.contacts, res.contact] : st.contacts.map((c) => (c.id === res.contact.id ? res.contact : c)),
    activities: [...st.activities, ...res.activities],
  }));
}

export interface SaveOptions {
  /** Admin confirmed booking past capacity (spec §5.6 override). */
  overrideCapacity?: boolean;
  /** When false and over capacity, throw CapacityError instead of waitlisting silently. */
  allowWaitlist?: boolean;
}

function computeFields(v: BookingForm, existing?: Booking) {
  const s = db.get();
  const ev = s.events.find((e) => e.id === v.eventId);
  if (!ev) throw new Error('Choose an event.');
  const discount = v.discountCode ? findDiscount(s.discounts, v.discountCode) : null;
  if (v.discountCode && !discount) throw new Error(`Discount code "${v.discountCode}" is not valid.`);
  const q = quote(ev, v.attendees, v.eventDateId, discount);
  const pay = enforceFreeEvent(q.isFree, v.paymentStatus, v.paymentMethod);
  return { ev, q, pay, discount, existing };
}

export async function createBooking(input: BookingForm, opts: SaveOptions = {}) {
  const me = currentUser();
  assertCan(me, 'write:bookings');
  const v = bookingFormSchema.parse(input);
  const { ev, q, pay } = computeFields(v);
  const s = db.get();
  const cap = checkCapacity(ev, s.bookings, v.attendees, v.eventDateId);
  if (!cap.fits && !opts.overrideCapacity && !opts.allowWaitlist) throw new CapacityError(cap.remaining, cap.capacity);
  const status = resolveStatusForCapacity(v.status, cap, !!opts.overrideCapacity);

  const booking: Booking = {
    id: newId(),
    ref: newBookingRef(new Set(s.bookings.map((b) => b.ref))),
    eventId: ev.id,
    eventDateId: v.eventDateId,
    customer: {
      fullName: v.fullName,
      email: v.email,
      phone: v.phone,
      occupation: v.occupation,
      company: v.company,
      role: v.role,
    },
    heardAbout: v.heardAbout,
    attendees: v.attendees,
    discountCode: q.discountAmount > 0 ? v.discountCode.toUpperCase() : '',
    discountLabel: q.discountLabel,
    discountAmount: q.discountAmount,
    amountPaid: pay.paymentStatus === 'completed' ? (v.amountPaid ?? q.total) : (v.amountPaid ?? 0),
    total: q.total,
    currency: ev.currency,
    status,
    paymentStatus: pay.paymentStatus,
    paymentMethod: pay.paymentMethod,
    transactionRef: v.transactionRef,
    specialRequirements: v.specialRequirements,
    internalNotes: v.internalNotes,
    tags: v.tags,
    source: 'Office',
    checkedIn: false,
    emailsSent: 0,
    smsSent: 0,
    createdAt: new Date().toISOString(),
  };
  db.set((st) => ({ bookings: [booking, ...st.bookings] }));
  syncCrm(booking);
  logAudit(me, 'Created booking', 'write', 'booking', booking.id, {
    ref: booking.ref,
    event: ev.title,
    status,
    overCapacity: cap.fits ? undefined : opts.overrideCapacity ? 'override' : 'waitlisted',
  });
  return booking;
}

export async function updateBooking(id: string, input: BookingForm, opts: SaveOptions = {}) {
  const me = currentUser();
  assertCan(me, 'write:bookings');
  const v = bookingFormSchema.parse(input);
  const s = db.get();
  const prev = s.bookings.find((b) => b.id === id);
  if (!prev) throw new Error('Booking not found.');
  const { ev, q, pay } = computeFields(v, prev);
  const cap = checkCapacity(ev, s.bookings, v.attendees, v.eventDateId, id);
  const needsSeat = v.attendees > prev.attendees || v.eventId !== prev.eventId || v.eventDateId !== prev.eventDateId;
  if (needsSeat && !cap.fits && !opts.overrideCapacity && !opts.allowWaitlist) throw new CapacityError(cap.remaining, cap.capacity);
  const status = needsSeat ? resolveStatusForCapacity(v.status, cap, !!opts.overrideCapacity) : v.status;

  const next: Booking = {
    ...prev,
    eventId: ev.id,
    eventDateId: v.eventDateId,
    customer: { fullName: v.fullName, email: v.email, phone: v.phone, occupation: v.occupation, company: v.company, role: v.role },
    heardAbout: v.heardAbout,
    attendees: v.attendees,
    discountCode: q.discountAmount > 0 ? v.discountCode.toUpperCase() : '',
    discountLabel: q.discountLabel,
    discountAmount: q.discountAmount,
    amountPaid: v.amountPaid ?? prev.amountPaid,
    total: q.total,
    currency: ev.currency,
    status,
    paymentStatus: pay.paymentStatus,
    paymentMethod: pay.paymentMethod,
    transactionRef: v.transactionRef,
    specialRequirements: v.specialRequirements,
    internalNotes: v.internalNotes,
    tags: v.tags,
  };
  db.set((st) => ({ bookings: st.bookings.map((b) => (b.id === id ? next : b)) }));
  syncCrm(next);
  logAudit(me, 'Updated booking', 'write', 'booking', id, diff(prev, next));
  return next;
}

function diff(a: Booking, b: Booking) {
  const out: Record<string, string> = { ref: a.ref };
  const keys: (keyof Booking)[] = ['status', 'paymentStatus', 'attendees', 'total', 'amountPaid', 'eventId'];
  for (const k of keys) if (a[k] !== b[k]) out[k] = `${String(a[k])} → ${String(b[k])}`;
  return out;
}

export async function updateBookingStatus(id: string, status: BookingStatus) {
  const me = currentUser();
  assertCan(me, 'write:bookings');
  const prev = db.get().bookings.find((b) => b.id === id);
  if (!prev) throw new Error('Booking not found.');
  db.set((st) => ({
    bookings: st.bookings.map((b) => (b.id === id ? { ...b, status, checkedIn: status === 'completed' ? true : b.checkedIn } : b)),
  }));
  logAudit(me, 'Updated booking status', 'write', 'booking', id, { ref: prev.ref, status: `${prev.status} → ${status}` });
}

export async function deleteBooking(id: string) {
  const me = currentUser();
  assertCan(me, 'delete:bookings');
  const prev = db.get().bookings.find((b) => b.id === id);
  if (!prev) return;
  db.set((st) => ({ bookings: st.bookings.filter((b) => b.id !== id) }));
  logAudit(me, 'Deleted booking', 'write', 'booking', id, { ref: prev.ref, customer: prev.customer.email });
}

export async function deleteBookings(ids: string[]) {
  for (const id of ids) await deleteBooking(id);
}

/**
 * Move a booking to another event (spec §5.4). Ref is kept; event and date
 * change; capacity is re-checked on the target.
 */
export async function transferBooking(
  id: string,
  targetEventId: string,
  targetDateId: string | null,
  notes: string,
  opts: SaveOptions = {},
) {
  const me = currentUser();
  assertCan(me, 'write:bookings');
  if (notes.length > 500) throw new Error('Transfer notes are at most 500 characters.');
  const s = db.get();
  const prev = s.bookings.find((b) => b.id === id);
  const target = s.events.find((e) => e.id === targetEventId);
  if (!prev || !target) throw new Error('Choose an event to transfer to.');
  if (prev.eventId === targetEventId && prev.eventDateId === targetDateId) throw new Error('The booking is already on this event.');
  const dateId = targetDateId ?? target.dates[0]?.id ?? null;
  const cap = checkCapacity(target, s.bookings, prev.attendees, dateId, id);
  if (!cap.fits && !opts.overrideCapacity) throw new CapacityError(cap.remaining, cap.capacity);
  const from = s.events.find((e) => e.id === prev.eventId);
  const next: Booking = {
    ...prev,
    eventId: target.id,
    eventDateId: dateId,
    currency: target.currency,
    internalNotes: notes ? [prev.internalNotes, `Transfer: ${notes}`].filter(Boolean).join('\n') : prev.internalNotes,
  };
  db.set((st) => ({ bookings: st.bookings.map((b) => (b.id === id ? next : b)) }));
  syncCrm(next);
  logAudit(me, 'Transferred booking', 'write', 'booking', id, {
    ref: prev.ref,
    event: `${from?.title ?? prev.eventId} → ${target.title}`,
    notes,
  });
  return next;
}

/**
 * Manual event message to a set of bookings (event Messages tab). Delivery is
 * simulated in the test build; counters and the audit log are updated. One
 * message per person even if they hold several bookings.
 */
export async function sendEventMessage(eventId: string, bookingIds: string[], channel: 'email' | 'sms', subject: string, body: string) {
  const me = currentUser();
  assertCan(me, 'write:bookings');
  if (channel === 'email' && !subject.trim()) throw new Error('Subject is required.');
  if (!body.trim()) throw new Error('Message is required.');
  const s = db.get();
  const seen = new Set<string>();
  const ids = new Set<string>();
  for (const b of s.bookings) {
    if (!bookingIds.includes(b.id)) continue;
    const key = channel === 'email' ? normEmail(b.customer.email) : b.customer.phone.replace(/\D/g, '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    ids.add(b.id);
  }
  if (!ids.size) throw new Error(`Nobody in these groups has ${channel === 'email' ? 'an email address' : 'a phone number'}.`);
  db.set((st) => ({
    bookings: st.bookings.map((b) =>
      ids.has(b.id) ? (channel === 'email' ? { ...b, emailsSent: b.emailsSent + 1 } : { ...b, smsSent: b.smsSent + 1 }) : b,
    ),
  }));
  const ev = s.events.find((e) => e.id === eventId);
  logAudit(me, 'Sent event message', 'write', 'event', eventId, { title: ev?.title, channel, recipients: ids.size, subject });
  return ids.size;
}

export function logBookingsList(filters: Record<string, unknown>, resultCount: number) {
  logAudit(currentUser(), 'list bookings', 'read', 'booking', '', { filters, resultCount });
}
