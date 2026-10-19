import { useMemo } from 'react';

import { useCurrentUser } from '@/auth/session';
import { ActivityFeed } from '@/components/ActivityFeed';
import { PageHeader, Screen } from '@/components/layout';
import { Card } from '@/components/ui';
import { useDb } from '@/data/db';

export default function MyActivity() {
  const me = useCurrentUser();
  const audit = useDb((s) => s.audit);
  // Actions by me, plus changes made to my account (by me or an Admin).
  const entries = useMemo(
    () => (me ? audit.filter((a) => a.actorEmail === me.email || (a.entityType === 'user' && a.entityId === me.id)) : []),
    [audit, me],
  );
  if (!me) return null;
  return (
    <Screen>
      <PageHeader title="My activity" description="What you changed in the back office, and changes made to your account." />
      <Card>
        <ActivityFeed entries={entries} absoluteTime pageSize={20} />
      </Card>
    </Screen>
  );
}
