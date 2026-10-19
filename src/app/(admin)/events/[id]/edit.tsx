import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useCurrentUser } from '@/auth/session';
import { EmptyState } from '@/components/ui';
import { db } from '@/data/db';
import { EventWizard } from '@/features/events/EventWizard';
import { can } from '@/lib/rbac';

export default function EditEvent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useCurrentUser();
  // Snapshot once so edits elsewhere don't reset the wizard mid-way.
  const [initial] = useState(() => db.get().events.find((e) => e.id === id));
  if (!initial) return <EmptyState title="Event not found" />;
  if (!can(me, 'write:events')) return <EmptyState title="Not allowed" body="Your role can view events but not edit them." />;
  return <EventWizard initial={JSON.parse(JSON.stringify(initial))} isNew={false} />;
}
