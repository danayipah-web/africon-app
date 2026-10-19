import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { EmptyState } from '@/components/ui';
import { db } from '@/data/db';
import { SegmentEditor } from '@/features/crm/SegmentEditor';

export default function EditSegment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [initial] = useState(() => db.get().segments.find((s) => s.id === id));
  if (!initial) return <EmptyState title="Segment not found" />;
  return <SegmentEditor initial={JSON.parse(JSON.stringify(initial))} isNew={false} />;
}
