import type { EventDate, EventItem } from '@/domain/types';
import { cedis, eventDateLine, shortDate } from '@/lib/format';
import { FORMAT_LABELS } from '@/lib/labels';

/** "Title - Mon D, YYYY at HH:MM - HH:MM (format)" used by the Bookings event filter. */
export function eventFilterLabel(e: EventItem) {
  const d = e.dates[0];
  const when = d ? eventDateLine(d.date, d.startTime, d.endTime) : 'No date';
  return `${e.title} - ${when} (${FORMAT_LABELS[e.format]})`;
}

/** "Title - Mon D, YYYY (GHS price)" used by the booking form event picker. */
export function eventPickerLabel(e: EventItem) {
  const d = e.dates[0];
  return `${e.title} - ${d ? shortDate(d.date) : 'No date'} (${e.currency} ${e.price.toLocaleString()})`;
}

export function dateEntryLabel(d: EventDate) {
  const range = d.type === 'range' && d.endDate ? `${shortDate(d.date)} – ${shortDate(d.endDate)}` : shortDate(d.date);
  return `${d.label ? `${d.label} · ` : ''}${range}, ${d.startTime}${d.endTime ? `–${d.endTime}` : ''}`;
}

/** "Nov 26, 2026 08:00 – 16:00" for the events list. */
export function eventDateSummary(e: EventItem) {
  const d = e.dates[0];
  if (!d) return 'No date';
  const more = e.dates.length > 1 ? ` (+${e.dates.length - 1} more)` : '';
  return `${shortDate(d.date)} ${d.startTime}${d.endTime ? ` – ${d.endTime}` : ''}${more}`;
}

export function eventSubtitle(e: EventItem) {
  const city = e.dates[0]?.location || e.country;
  return `${e.category || 'Uncategorised'} · ${FORMAT_LABELS[e.format]} · ${city}`;
}

export function priceLabel(e: Pick<EventItem, 'price' | 'currency'>) {
  return e.price === 0 ? 'Free' : cedis(e.price, e.currency);
}
