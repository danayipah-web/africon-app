// Display formatting. All admin times are shown in GMT (Ghana time), spec §0.5.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad = (n: number) => String(n).padStart(2, '0');

export function money(amount: number, currency: string = 'GHS', decimals = 2) {
  return `${currency} ${amount.toFixed(decimals)}`;
}

/** Compact cedi form used on cards: ₵321,499 */
export function cedis(amount: number, currency: string = 'GHS') {
  const sym = currency === 'USD' ? '$' : '₵';
  return `${sym}${Math.round(amount).toLocaleString('en-US')}`;
}

export function compactMoney(amount: number, currency = 'GHS') {
  if (amount >= 1_000_000) return `${currency} ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${currency} ${(amount / 1_000).toFixed(1)}K`;
  return `${currency} ${amount.toFixed(0)}`;
}

/** "Oct 13, 2026" from an ISO string or YYYY-MM-DD. */
export function shortDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (isNaN(d.getTime())) return '—';
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function dateTime(iso: string | null | undefined) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Never';
  return `${shortDate(iso)}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} GMT`;
}

export function longToday(now = new Date()) {
  return `${DAYS_LONG[now.getUTCDay()]}, ${MONTHS_LONG[now.getUTCMonth()]} ${now.getUTCDate()}, ${now.getUTCFullYear()}`;
}

export function relativeTime(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return 'Never';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return 'Never';
  const diff = Math.round((now - t) / 1000);
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? 'ago' : 'from now';
  if (abs < 60) return 'just now';
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, 'year'],
    [60 * 60 * 24 * 30, 'month'],
    [60 * 60 * 24 * 7, 'week'],
    [60 * 60 * 24, 'day'],
    [60 * 60, 'hour'],
    [60, 'minute'],
  ];
  for (const [secs, name] of units) {
    if (abs >= secs) {
      const n = Math.floor(abs / secs);
      return `${n} ${name}${n === 1 ? '' : 's'} ${suffix}`;
    }
  }
  return 'just now';
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || '?'
  );
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** "Mon D, YYYY at HH:MM" for an event date entry. */
export function eventDateLine(date: string, startTime?: string, endTime?: string) {
  const base = shortDate(date);
  if (!startTime) return base;
  return endTime ? `${base} at ${startTime} - ${endTime}` : `${base} at ${startTime}`;
}

export function todayISODate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}
