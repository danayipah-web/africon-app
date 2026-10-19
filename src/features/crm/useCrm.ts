import { useMemo } from 'react';

import { useDb } from '@/data/db';
import { buildContext } from '@/lib/segments/evaluate';

/** Evaluation context for the filter builder, rebuilt when the underlying data changes. */
export function useEvalContext() {
  const bookings = useDb((s) => s.bookings);
  const activities = useDb((s) => s.activities);
  const segments = useDb((s) => s.segments);
  return useMemo(() => buildContext(bookings, activities, segments), [bookings, activities, segments]);
}
