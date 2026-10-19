import { useState } from 'react';

import { useCurrentUser } from '@/auth/session';
import { EmptyState } from '@/components/ui';
import { blankEvent } from '@/domain/defaults';
import { EventWizard } from '@/features/events/EventWizard';
import { can } from '@/lib/rbac';

export default function NewEvent() {
  const me = useCurrentUser();
  const [initial] = useState(() => blankEvent());
  if (!can(me, 'write:events')) return <EmptyState title="Not allowed" body="Your role can view events but not create them." />;
  return <EventWizard initial={initial} isNew />;
}
