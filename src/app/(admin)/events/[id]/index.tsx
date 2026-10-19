import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { useCurrentUser } from '@/auth/session';
import { PageHeader, Screen, Tabs } from '@/components/layout';
import { confirm, toast, toastError } from '@/components/overlays';
import { Button, EmptyState, Row, StatusPill, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import { deleteEvent, duplicateEvent, logEventView } from '@/data/repo/events';
import { eventDateSummary, eventSubtitle, priceLabel } from '@/domain/eventLabels';
import {
  AttendeesTab,
  AutomationsTab,
  CertificatesTab,
  MessagesTab,
  OrdersTab,
  OverviewTab,
  SourcesTab,
} from '@/features/events/EventTabs';
import { EVENT_STATUS_LABELS } from '@/lib/labels';
import { can } from '@/lib/rbac';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'attendees', label: 'Attendees' },
  { value: 'orders', label: 'Orders' },
  { value: 'messages', label: 'Messages' },
  { value: 'automations', label: 'Automations' },
  { value: 'sources', label: 'Sources' },
  { value: 'certificates', label: 'Certificates' },
] as const;
type TabKey = (typeof TABS)[number]['value'];

export default function EventDetail() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: TabKey }>();
  const me = useCurrentUser();
  const e = useDb((s) => s.events.find((x) => x.id === id));
  const bookings = useDb((s) => s.bookings);
  const [tab, setTab] = useState<TabKey>(tabParam ?? 'overview');
  const list = useMemo(() => bookings.filter((b) => b.eventId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [bookings, id]);

  useEffect(() => {
    if (id) logEventView(id);
  }, [id]);

  if (!e) return <EmptyState title="Event not found" body="It may have been deleted." />;

  const onDuplicate = async () => {
    try {
      const copy = await duplicateEvent(e.id);
      toast(`Created "${copy.title}" as a draft`);
      router.replace(`/events/${copy.id}`);
    } catch (err) {
      toastError(err);
    }
  };
  const onDelete = async () => {
    if (!(await confirm({ title: 'Delete event?', message: `"${e.title}" will be permanently deleted.`, confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await deleteEvent(e.id);
      toast('Event deleted');
      router.back();
    } catch (err) {
      toastError(err);
    }
  };

  const Tab = { overview: OverviewTab, attendees: AttendeesTab, orders: OrdersTab, messages: MessagesTab, automations: AutomationsTab, sources: SourcesTab, certificates: CertificatesTab }[tab];

  return (
    <Screen>
      <PageHeader
        title={e.title}
        description="Event Details and Management"
        actions={
          <>
            {can(me, 'write:events') ? <Button title="Edit Event" onPress={() => router.push(`/events/${e.id}/edit`)} /> : null}
            {can(me, 'write:events') ? <Button title="Duplicate" variant="secondary" onPress={onDuplicate} /> : null}
            {can(me, 'delete:events') ? <Button title="Delete" variant="danger" onPress={onDelete} /> : null}
          </>
        }
      />
      <Row wrap gap={8}>
        <StatusPill value={e.status} label={EVENT_STATUS_LABELS[e.status]} />
        <Txt v="faint">{eventSubtitle(e)}</Txt>
      </Row>
      <Txt v="small">
        {eventDateSummary(e)} · {priceLabel(e)}
      </Txt>
      <Tabs tabs={[...TABS]} value={tab} onChange={setTab} />
      <Tab e={e} list={list} />
    </Screen>
  );
}
