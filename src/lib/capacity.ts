import type { Booking, EventItem } from '@/domain/types';

const HOLDS_SEAT: Booking['status'][] = ['pending', 'confirmed', 'completed'];

/** Capacity for a date entry: its maxRegistrations, or the event capacity when empty. */
export function capacityFor(event: Pick<EventItem, 'capacity' | 'dates'>, eventDateId?: string | null) {
  const d = eventDateId ? event.dates.find((x) => x.id === eventDateId) : undefined;
  return d?.maxRegistrations ?? event.capacity;
}

/** Seats taken on an event (or one of its dates). Waitlist, cancelled and no-show do not hold a seat. */
export function seatsTaken(
  bookings: Pick<Booking, 'eventId' | 'eventDateId' | 'status' | 'attendees' | 'id'>[],
  eventId: string,
  eventDateId?: string | null,
  excludeBookingId?: string,
) {
  return bookings
    .filter(
      (b) =>
        b.eventId === eventId &&
        b.id !== excludeBookingId &&
        HOLDS_SEAT.includes(b.status) &&
        (eventDateId ? b.eventDateId === eventDateId : true),
    )
    .reduce((sum, b) => sum + b.attendees, 0);
}

export interface CapacityCheck {
  capacity: number;
  taken: number;
  remaining: number;
  fits: boolean;
}

export function checkCapacity(
  event: Pick<EventItem, 'id' | 'capacity' | 'dates'>,
  bookings: Pick<Booking, 'eventId' | 'eventDateId' | 'status' | 'attendees' | 'id'>[],
  attendees: number,
  eventDateId?: string | null,
  excludeBookingId?: string,
): CapacityCheck {
  const capacity = capacityFor(event, eventDateId);
  const taken = seatsTaken(bookings, event.id, eventDateId, excludeBookingId);
  const remaining = Math.max(0, capacity - taken);
  return { capacity, taken, remaining, fits: attendees <= remaining };
}

/**
 * Status to store for a new/moved booking: over capacity goes to the waitlist
 * unless the admin confirmed an override (spec §5.6).
 */
export function resolveStatusForCapacity(
  requested: Booking['status'],
  check: CapacityCheck,
  override: boolean,
): Booking['status'] {
  if (!HOLDS_SEAT.includes(requested)) return requested;
  if (check.fits || override) return requested;
  return 'waitlist';
}
