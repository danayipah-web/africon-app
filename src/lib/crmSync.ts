import type { Booking, Contact, ContactActivity, EventItem, Money } from '@/domain/types';
import { newId } from '@/lib/ids';

// Keeps CRM contacts in step with bookings and imports (spec §5.6, §6.3, §6.6).

const PAID: Booking['paymentStatus'][] = ['completed', 'partially_refunded'];

export const normEmail = (e: string) => e.trim().toLowerCase();

/** Normalise Ghana numbers to +233XXXXXXXXX; other numbers keep their digits with a leading +. */
export function normPhone(p: string) {
  const d = p.replace(/\D/g, '');
  if (!d) return '';
  if (/^0\d{9}$/.test(d)) return `+233${d.slice(1)}`;
  if (/^233\d{9}$/.test(d)) return `+${d}`;
  return `+${d}`;
}

/** Match on email first, then normalised phone (spec §5.6). */
export function findContact(contacts: Contact[], email: string, phone: string): Contact | undefined {
  const e = normEmail(email);
  if (e) {
    const byEmail = contacts.find((c) => normEmail(c.email) === e);
    if (byEmail) return byEmail;
  }
  const p = normPhone(phone);
  if (p) return contacts.find((c) => normPhone(c.phone) === p);
  return undefined;
}

export function blankContact(now: string, patch: Partial<Contact> = {}): Contact {
  return {
    id: newId(),
    fullName: '',
    email: '',
    phone: '',
    company: '',
    jobTitle: '',
    country: '',
    city: '',
    tags: [],
    notes: '',
    internalNotes: '',
    lifecycleStage: 'lead',
    leadStatus: 'New',
    ownerId: null,
    leadScore: 0,
    totalSpent: [],
    paidBookingsCount: 0,
    customerSince: null,
    lastPaidBookingAt: null,
    hasRefund: false,
    markedCustomerManually: false,
    needsReview: false,
    sources: [],
    firstSource: '',
    emailOptOut: false,
    smsOptOut: false,
    marketingConsent: false,
    emailsSent: 0,
    smsSent: 0,
    lastEmailAt: null,
    lastSmsAt: null,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

function addMoney(list: Money[], amount: number, currency: Money['currency']) {
  const out = list.map((m) => ({ ...m }));
  const m = out.find((x) => x.currency === currency);
  if (m) m.amount = Math.round((m.amount + amount) * 100) / 100;
  else out.push({ amount, currency });
  return out;
}

/** Revenue fields derived from every booking under the contact's email. */
export function revenueFromBookings(bookings: Booking[]) {
  const paid = bookings.filter((b) => PAID.includes(b.paymentStatus) && b.amountPaid > 0);
  let totalSpent: Money[] = [];
  for (const b of paid) totalSpent = addMoney(totalSpent, b.amountPaid, b.currency);
  const dates = paid.map((b) => b.createdAt).sort();
  return {
    totalSpent,
    paidBookingsCount: paid.length,
    customerSince: dates[0] ?? null,
    lastPaidBookingAt: dates[dates.length - 1] ?? null,
    hasRefund: bookings.some((b) => b.paymentStatus === 'refunded' || b.paymentStatus === 'partially_refunded'),
  };
}

export interface SyncResult {
  contact: Contact;
  created: boolean;
  activities: ContactActivity[];
}

/**
 * Upsert the contact for a booking and record activity. `allBookingsForEmail`
 * must include `booking` itself so revenue is recomputed from the full history.
 */
export function syncBooking(
  contacts: Contact[],
  booking: Booking,
  event: Pick<EventItem, 'title'> | undefined,
  allBookingsForEmail: Booking[],
  now: string,
): SyncResult {
  const existing = findContact(contacts, booking.customer.email, booking.customer.phone);
  const activities: ContactActivity[] = [];
  const created = !existing;
  let contact: Contact = existing
    ? { ...existing }
    : blankContact(now, {
        fullName: booking.customer.fullName,
        email: booking.customer.email.trim(),
        phone: booking.customer.phone ? normPhone(booking.customer.phone) : '',
        company: booking.customer.company,
        jobTitle: booking.customer.role,
        sources: ['Booking'],
        firstSource: 'Booking',
      });

  if (created) {
    activities.push(act(contact.id, 'created', 'Booking', `Contact created via booking ${booking.ref}`, now));
  } else {
    // Fill blanks only; never overwrite what the office has edited.
    contact.fullName ||= booking.customer.fullName;
    contact.phone ||= booking.customer.phone ? normPhone(booking.customer.phone) : '';
    contact.company ||= booking.customer.company;
    contact.jobTitle ||= booking.customer.role;
    if (!contact.sources.includes('Booking')) contact.sources = [...contact.sources, 'Booking'];
  }

  const wasCustomer = contact.lifecycleStage === 'customer';
  const rev = revenueFromBookings(allBookingsForEmail);
  contact = { ...contact, ...rev, lastActivityAt: now, updatedAt: now };
  if (rev.paidBookingsCount > 0 && !wasCustomer) {
    contact.lifecycleStage = 'customer';
    activities.push(
      act(contact.id, 'lifecycle', 'Booking', 'Became a customer: first completed payment recorded', now),
    );
  }

  activities.push({
    ...act(
      contact.id,
      'booking',
      'Booking',
      `Booked ${event?.title ?? 'an event'} (${booking.ref}) · ${booking.attendees} attendee${booking.attendees === 1 ? '' : 's'}`,
      now,
    ),
    amount: { amount: booking.total, currency: booking.currency },
    eventId: booking.eventId,
    bookingId: booking.id,
  });

  return { contact, created, activities };
}

export function act(
  contactId: string,
  type: ContactActivity['type'],
  source: string,
  summary: string,
  at: string,
): ContactActivity {
  return { id: newId(), contactId, type, source, summary, at };
}

/**
 * Merge `dup` into `primary` (spec §6.3): keep every activity, keep the newest
 * identity fields, sum revenue. Caller deletes `dup` afterwards.
 */
export function mergeContacts(
  primary: Contact,
  dup: Contact,
  activities: ContactActivity[],
  now: string,
): { contact: Contact; activities: ContactActivity[] } {
  const newer = primary.updatedAt >= dup.updatedAt ? primary : dup;
  const older = newer === primary ? dup : primary;
  const pick = <K extends keyof Contact>(k: K) => (newer[k] || older[k]) as Contact[K];

  let totalSpent = primary.totalSpent.map((m) => ({ ...m }));
  for (const m of dup.totalSpent) totalSpent = addMoney(totalSpent, m.amount, m.currency);

  const minDate = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);
  const maxDate = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

  const contact: Contact = {
    ...primary,
    fullName: pick('fullName'),
    email: pick('email'),
    phone: pick('phone'),
    company: pick('company'),
    jobTitle: pick('jobTitle'),
    country: pick('country'),
    city: pick('city'),
    notes: [primary.notes, dup.notes].filter(Boolean).join('\n'),
    internalNotes: [primary.internalNotes, dup.internalNotes].filter(Boolean).join('\n'),
    tags: Array.from(new Set([...primary.tags, ...dup.tags])),
    sources: Array.from(new Set([...primary.sources, ...dup.sources])),
    firstSource: primary.createdAt <= dup.createdAt ? primary.firstSource : dup.firstSource,
    lifecycleStage: primary.lifecycleStage === 'customer' || dup.lifecycleStage === 'customer' ? 'customer' : 'lead',
    leadScore: Math.max(primary.leadScore, dup.leadScore),
    totalSpent,
    paidBookingsCount: primary.paidBookingsCount + dup.paidBookingsCount,
    customerSince: minDate(primary.customerSince, dup.customerSince),
    lastPaidBookingAt: maxDate(primary.lastPaidBookingAt, dup.lastPaidBookingAt),
    hasRefund: primary.hasRefund || dup.hasRefund,
    markedCustomerManually: primary.markedCustomerManually || dup.markedCustomerManually,
    emailOptOut: primary.emailOptOut || dup.emailOptOut,
    smsOptOut: primary.smsOptOut || dup.smsOptOut,
    marketingConsent: newer.marketingConsent,
    emailsSent: primary.emailsSent + dup.emailsSent,
    smsSent: primary.smsSent + dup.smsSent,
    lastEmailAt: maxDate(primary.lastEmailAt, dup.lastEmailAt),
    lastSmsAt: maxDate(primary.lastSmsAt, dup.lastSmsAt),
    lastActivityAt: maxDate(primary.lastActivityAt, dup.lastActivityAt),
    createdAt: minDate(primary.createdAt, dup.createdAt)!,
    needsReview: false,
    updatedAt: now,
  };

  const moved = activities.map((a) => (a.contactId === dup.id ? { ...a, contactId: primary.id } : a));
  moved.push(act(primary.id, 'merge', 'Office', `Merged duplicate ${dup.fullName || dup.email || dup.phone}`, now));
  return { contact, activities: moved };
}

/** Flag likely duplicates: same normalised phone or same name with different emails. */
export function flagPossibleDuplicates(contacts: Contact[]): Set<string> {
  const flagged = new Set<string>();
  const byPhone = new Map<string, string[]>();
  const byName = new Map<string, string[]>();
  for (const c of contacts) {
    const p = normPhone(c.phone);
    if (p) byPhone.set(p, [...(byPhone.get(p) ?? []), c.id]);
    const n = c.fullName.trim().toLowerCase();
    if (n) byName.set(n, [...(byName.get(n) ?? []), c.id]);
  }
  for (const ids of [...byPhone.values(), ...byName.values()]) if (ids.length > 1) ids.forEach((id) => flagged.add(id));
  return flagged;
}
