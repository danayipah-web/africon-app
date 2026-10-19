import { router } from 'expo-router';
import { Copy, ListTodo, Pencil, Plus, SlidersHorizontal, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useCurrentUser } from '@/auth/session';
import { SearchInput, Select } from '@/components/form';
import { ListRow, PageHeader, Pager, paginate, Screen } from '@/components/layout';
import { confirm, toast, toastError } from '@/components/overlays';
import { Button, Card, EmptyState, IconButton, Row, StatusPill, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import { deleteEvent, duplicateEvent } from '@/data/repo/events';
import { firstDate } from '@/domain/defaults';
import { eventDateSummary, eventSubtitle, priceLabel } from '@/domain/eventLabels';
import type { EventItem } from '@/domain/types';
import { seatsTaken } from '@/lib/capacity';
import { EVENT_STATUS_LABELS } from '@/lib/labels';
import { can } from '@/lib/rbac';

const DAY = 864e5;

export default function EventsList() {
  const me = useCurrentUser();
  const events = useDb((s) => s.events);
  const bookings = useDb((s) => s.bookings);
  const categories = useDb((s) => s.metadata.categories);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [format, setFormat] = useState('all');
  const [currency, setCurrency] = useState('all');
  const [featured, setFeatured] = useState('all');
  const [created, setCreated] = useState('all');
  const [sort, setSort] = useState<'date_desc' | 'date_asc' | 'title'>('date_desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [now] = useState(() => Date.now());

  const canWrite = can(me, 'write:events');
  const canDelete = can(me, 'delete:events');

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = events.filter((e) => {
      if (status !== 'all' && e.status !== status) return false;
      if (category !== 'all' && e.category !== category) return false;
      if (format !== 'all' && e.format !== format) return false;
      if (currency !== 'all' && e.currency !== currency) return false;
      if (featured === 'yes' && !e.options.featured) return false;
      if (featured === 'no' && e.options.featured) return false;
      if (created !== 'all' && new Date(e.createdAt).getTime() < now - Number(created) * DAY) return false;
      if (s) {
        const hay = `${e.title} ${e.description} ${e.dates.map((d) => `${d.location} ${d.venue}`).join(' ')}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
    return out.sort((a, b) =>
      sort === 'title' ? a.title.localeCompare(b.title) : sort === 'date_asc' ? firstDate(a).localeCompare(firstDate(b)) : firstDate(b).localeCompare(firstDate(a)),
    );
  }, [events, q, status, category, format, currency, featured, created, sort, now]);

  const clearFilters = () => {
    setFormat('all');
    setCurrency('all');
    setFeatured('all');
    setCreated('all');
    setStatus('all');
    setCategory('all');
    setQ('');
  };

  const onDuplicate = async (e: EventItem) => {
    try {
      const copy = await duplicateEvent(e.id);
      toast(`Created "${copy.title}" as a draft`);
      router.push(`/events/${copy.id}`);
    } catch (err) {
      toastError(err);
    }
  };

  const onDelete = async (e: EventItem) => {
    if (!(await confirm({ title: 'Delete event?', message: `"${e.title}" will be permanently deleted.`, confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await deleteEvent(e.id);
      toast('Event deleted');
    } catch (err) {
      toastError(err);
    }
  };

  const shown = paginate(rows, page, perPage);

  return (
    <Screen>
      <PageHeader
        title="Events & Trainings"
        description="Manage events, trainings, schedules, and details"
        actions={
          <>
            <Button title="Due work" icon={ListTodo} variant="secondary" onPress={() => router.push('/events/due')} />
            {canWrite ? <Button title="Create event" icon={Plus} onPress={() => router.push('/events/new')} /> : null}
          </>
        }
      />
      <Card>
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search events or trainings by title, description, location..." />
        <Row>
          <View style={{ flex: 1 }}>
            <Select
              compact
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              options={[{ value: 'all', label: 'All Status' }, ...Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Select compact value={category} onChange={(v) => { setCategory(v); setPage(1); }} options={[{ value: 'all', label: 'All Categories' }, ...categories.map((x) => ({ value: x, label: x }))]} />
          </View>
        </Row>
        <Row style={{ marginTop: 8, justifyContent: 'space-between' }}>
          <Button small variant="secondary" icon={SlidersHorizontal} title={showFilters ? 'Hide filters' : 'Filters'} onPress={() => setShowFilters((x) => !x)} />
          <View style={{ width: 170 }}>
            <Select
              compact
              value={sort}
              onChange={setSort}
              options={[
                { value: 'date_desc', label: 'Date (latest)' },
                { value: 'date_asc', label: 'Date (earliest)' },
                { value: 'title', label: 'Event (A→Z)' },
              ]}
            />
          </View>
        </Row>
        {showFilters ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <Select label="Format" value={format} onChange={setFormat} options={[{ value: 'all', label: 'All Formats' }, { value: 'in_person', label: 'In Person' }, { value: 'virtual', label: 'Virtual' }, { value: 'hybrid', label: 'Hybrid' }]} />
            <Select label="Currency" value={currency} onChange={setCurrency} options={[{ value: 'all', label: 'All Currencies' }, { value: 'GHS', label: 'GHS' }, { value: 'USD', label: 'USD' }]} />
            <Select label="Featured" value={featured} onChange={setFeatured} options={[{ value: 'all', label: 'All Events' }, { value: 'yes', label: 'Featured Only' }, { value: 'no', label: 'Not Featured' }]} />
            <Select label="Created" value={created} onChange={setCreated} options={[{ value: 'all', label: 'All Time' }, { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }]} />
            <Button title="Clear Filters" variant="ghost" onPress={clearFilters} />
          </View>
        ) : null}
      </Card>

      {rows.length === 0 ? <EmptyState title="No events match" body="Clear the filters or create a new event." /> : null}
      <View style={{ gap: 8 }}>
        {shown.map((e) => {
          const taken = seatsTaken(bookings, e.id);
          return (
            <ListRow key={e.id} onPress={() => router.push(`/events/${e.id}`)}>
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt v="label">{e.title}</Txt>
                  <Txt v="faint">{eventSubtitle(e)}</Txt>
                </View>
                <StatusPill value={e.status} label={EVENT_STATUS_LABELS[e.status]} />
              </Row>
              <Row wrap gap={12}>
                <Txt v="small">{eventDateSummary(e)}</Txt>
                <Txt v="small">
                  {taken} / {e.capacity}
                </Txt>
                <Txt v="small" style={{ fontWeight: '700' }}>
                  {priceLabel(e)}
                </Txt>
              </Row>
              {canWrite || canDelete ? (
                <Row gap={0} style={{ justifyContent: 'flex-end', marginTop: -4 }}>
                  {canWrite ? <IconButton icon={Copy} label={`Duplicate ${e.title}`} onPress={() => onDuplicate(e)} size={18} /> : null}
                  {canWrite ? <IconButton icon={Pencil} label={`Edit ${e.title}`} onPress={() => router.push(`/events/${e.id}/edit`)} size={18} /> : null}
                  {canDelete ? <IconButton icon={Trash2} label={`Delete ${e.title}`} onPress={() => onDelete(e)} size={18} /> : null}
                </Row>
              ) : null}
            </ListRow>
          );
        })}
      </View>
      <Pager page={page} perPage={perPage} total={rows.length} onPage={setPage} onPerPage={(n) => { setPerPage(n); setPage(1); }} />
    </Screen>
  );
}
