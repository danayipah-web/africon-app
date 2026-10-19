const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const UPPER_ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomString(len: number, alphabet: string, rand: () => number = Math.random) {
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(rand() * alphabet.length)];
  return out;
}

/** Firestore-style 20 char document id. */
export function newId(rand?: () => number) {
  return randomString(20, ALNUM, rand);
}

/** Booking ref: BK-{YYYY}-{6 uppercase alphanumerics}, unique against `existing` (spec §5.6). */
export function newBookingRef(existing: Set<string> | string[], year = new Date().getUTCFullYear(), rand?: () => number) {
  const taken = existing instanceof Set ? existing : new Set(existing);
  for (let i = 0; i < 1000; i++) {
    const ref = `BK-${year}-${randomString(6, UPPER_ALNUM, rand)}`;
    if (!taken.has(ref)) return ref;
  }
  throw new Error('Could not generate a unique booking reference');
}

export const BOOKING_REF_PATTERN = /^BK-\d{4}-[A-Z0-9]{6}$/;
