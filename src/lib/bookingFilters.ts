import type { Booking, BookingStatus, EventItem, PaymentStatus } from '@/domain/types';
import { firstDate } from '@/domain/defaults';
import { normEmail } from './crmSync';

export interface BookingFilters {
  eventId: string; // 'all' or id
  q: string;
  duplicatesOnly: boolean;
  status: 'all' | BookingStatus;
  paymentStatus: 'all' | PaymentStatus;
  startDate: string; // YYYY-MM-DD on createdAt
  endDate: string;
  sort: 'created_desc' | 'created_asc' | 'event_desc' | 'event_asc';
}

export const DEFAULT_BOOKING_FILTERS: BookingFilters = {
  eventId: 'all',
  q: '',
  duplicatesOnly: false,
  status: 'all',
  paymentStatus: 'all',
  startDate: '',
  endDate: '',
  sort: 'created_desc',
};

/** Same email booked onto the same event more than once (spec §5.2). */
export function duplicateIds(bookings: Booking[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const b of bookings) {
    const k = `${b.eventId}|${normEmail(b.customer.email)}`;
    groups.set(k, [...(groups.get(k) ?? []), b.id]);
  }
  const out = new Set<string>();
  for (const ids of groups.values()) if (ids.length > 1) ids.forEach((id) => out.add(id));
  return out;
}

/** All filters combine with AND; search matches name, email or booking ref. */
export function filterBookings(bookings: Booking[], events: EventItem[], f: BookingFilters): Booking[] {
  const s = f.q.trim().toLowerCase();
  const dups = f.duplicatesOnly ? duplicateIds(bookings) : null;
  const eventDate = new Map(events.map((e) => [e.id, firstDate(e)]));
  const dateOf = (b: Booking) => {
    const e = events.find((x) => x.id === b.eventId);
    return e?.dates.find((d) => d.id === b.eventDateId)?.date ?? eventDate.get(b.eventId) ?? '';
  };
  const rows = bookings.filter((b) => {
    if (f.eventId !== 'all' && b.eventId !== f.eventId) return false;
    if (f.status !== 'all' && b.status !== f.status) return false;
    if (f.paymentStatus !== 'all' && b.paymentStatus !== f.paymentStatus) return false;
    if (f.startDate && b.createdAt.slice(0, 10) < f.startDate) return false;
    if (f.endDate && b.createdAt.slice(0, 10) > f.endDate) return false;
    if (dups && !dups.has(b.id)) return false;
    if (s && !`${b.customer.fullName} ${b.customer.email} ${b.ref}`.toLowerCase().includes(s)) return false;
    return true;
  });
  const cmp: Record<BookingFilters['sort'], (a: Booking, b: Booking) => number> = {
    created_desc: (a, b) => b.createdAt.localeCompare(a.createdAt),
    created_asc: (a, b) => a.createdAt.localeCompare(b.createdAt),
    event_desc: (a, b) => dateOf(b).localeCompare(dateOf(a)),
    event_asc: (a, b) => dateOf(a).localeCompare(dateOf(b)),
  };
  return rows.sort(cmp[f.sort]);
}

/** Readable summary of active filters for the audit log. */
export function activeFilters(f: BookingFilters, events: EventItem[]) {
  const out: Record<string, string | boolean> = {};
  if (f.eventId !== 'all') out.event = events.find((e) => e.id === f.eventId)?.title ?? f.eventId;
  if (f.status !== 'all') out.status = f.status;
  if (f.paymentStatus !== 'all') out.payment = f.paymentStatus;
  if (f.startDate) out.from = f.startDate;
  if (f.endDate) out.to = f.endDate;
  if (f.duplicatesOnly) out.duplicatesOnly = true;
  if (f.q) out.search = f.q;
  return out;
}
