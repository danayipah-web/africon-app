import { firstDate } from '@/domain/defaults';
import type { Booking, EventItem } from '@/domain/types';

export type MyBookingsView = 'open' | 'payment' | 'upcoming' | 'past' | 'all' | 'unassigned';

const OPEN = new Set<Booking['status']>(['pending', 'confirmed', 'waitlist']);
const UNPAID = new Set<Booking['paymentStatus']>(['pending', 'pay_later', 'failed', 'processing']);

/** Session date of a booking, falling back to the event's first date. */
export function sessionDate(b: Booking, events: Map<string, EventItem>): string {
  const e = events.get(b.eventId);
  if (!e) return '';
  return e.dates.find((d) => d.id === b.eventDateId)?.date ?? firstDate(e) ?? '';
}

export function needsPayment(b: Booking) {
  return b.status !== 'cancelled' && UNPAID.has(b.paymentStatus);
}

/** Buckets for the My bookings screen. `today` is YYYY-MM-DD. */
export function matchesView(b: Booking, view: MyBookingsView, userId: string, events: Map<string, EventItem>, today: string) {
  if (view === 'unassigned') return b.assignedTo === null;
  if (b.assignedTo !== userId) return false;
  const date = sessionDate(b, events);
  switch (view) {
    case 'open':
      return OPEN.has(b.status);
    case 'payment':
      return needsPayment(b);
    case 'upcoming':
      return OPEN.has(b.status) && date >= today;
    case 'past':
      return date !== '' && date < today;
    case 'all':
      return true;
  }
}

/** Upcoming first (soonest at top), then past (most recent at top). */
export function sortBySession(rows: Booking[], events: Map<string, EventItem>, today: string) {
  return [...rows].sort((a, b) => {
    const da = sessionDate(a, events);
    const db = sessionDate(b, events);
    const fa = da >= today;
    const fb = db >= today;
    if (fa !== fb) return fa ? -1 : 1;
    return fa ? da.localeCompare(db) : db.localeCompare(da);
  });
}
