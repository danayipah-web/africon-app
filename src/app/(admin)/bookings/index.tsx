import { router, useLocalSearchParams } from 'expo-router';
import { Download, Mail, MessageSquare, Pencil, Plus, SlidersHorizontal, Trash2, TriangleAlert } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useCurrentUser } from '@/auth/session';
import { Checkbox, DateField, SearchInput, Select } from '@/components/form';
import { ListRow, PageHeader, Pager, paginate, Screen, Tabs } from '@/components/layout';
import { confirm, toast, toastError } from '@/components/overlays';
import { Button, Card, EmptyState, IconButton, Row, StatusPill, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import { deleteBooking, deleteBookings, logBookingsList } from '@/data/repo/bookings';
import { eventFilterLabel } from '@/domain/eventLabels';
import type { Booking } from '@/domain/types';
import { BookingsAnalytics } from '@/features/bookings/BookingsAnalytics';
import { activeFilters, DEFAULT_BOOKING_FILTERS, duplicateIds, filterBookings, type BookingFilters } from '@/lib/bookingFilters';
import { toCsv } from '@/lib/csv';
import { eventDateLine, money, shortDate } from '@/lib/format';
import { BOOKING_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/labels';
import { can } from '@/lib/rbac';
import { shareCsv, stamp } from '@/lib/share';
import { useTheme } from '@/theme';

const enumOpts = <T extends string>(all: string, labels: Record<T, string>) => [{ value: 'all', label: all }, ...(Object.keys(labels) as T[]).map((k) => ({ value: k, label: labels[k] }))];

export default function BookingsScreen() {
  const params = useLocalSearchParams<{ eventId?: string }>();
  const me = useCurrentUser();
  const { c, tones } = useTheme();
  const bookings = useDb((s) => s.bookings);
  const events = useDb((s) => s.events);
  const [tab, setTab] = useState<'all' | 'analytics'>('all');
  const [f, setF] = useState<BookingFilters>({ ...DEFAULT_BOOKING_FILTERS, eventId: params.eventId ?? 'all' });
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(30);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Follow ?eventId= when arriving from an event page.
  const [paramEvent, setParamEvent] = useState(params.eventId);
  if (params.eventId !== paramEvent) {
    setParamEvent(params.eventId);
    if (params.eventId) setF((x) => ({ ...x, eventId: params.eventId! }));
  }

  const rows = useMemo(() => filterBookings(bookings, events, f), [bookings, events, f]);
  const dupSet = useMemo(() => duplicateIds(bookings), [bookings]);
  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  useEffect(() => {
    logBookingsList(activeFilters(f, events), rows.length);
    // Log once per screen visit, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upd = (patch: Partial<BookingFilters>) => {
    setF((x) => ({ ...x, ...patch }));
    setPage(1);
  };
  const canWrite = can(me, 'write:bookings');
  const canDelete = can(me, 'delete:bookings');

  const exportCsv = async (list: Booking[]) => {
    try {
      const csv = toCsv(
        list.map((b) => {
          const e = eventsById.get(b.eventId);
          return {
            ref: b.ref,
            customer: b.customer.fullName,
            email: b.customer.email,
            phone: b.customer.phone,
            company: b.customer.company,
            event: e?.title ?? '',
            attendees: b.attendees,
            status: BOOKING_STATUS_LABELS[b.status],
            payment: PAYMENT_STATUS_LABELS[b.paymentStatus],
            method: PAYMENT_METHOD_LABELS[b.paymentMethod],
            total: b.total,
            amountPaid: b.amountPaid,
            currency: b.currency,
            discount: b.discountCode,
            heardAbout: b.heardAbout,
            created: b.createdAt,
          };
        }),
      );
      await shareCsv(`bookings-${stamp()}.csv`, csv);
    } catch (e) {
      toastError(e);
    }
  };

  const onDelete = async (b: Booking) => {
    if (!(await confirm({ title: 'Delete booking?', message: `${b.ref} for ${b.customer.fullName} will be permanently deleted.`, confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await deleteBooking(b.id);
      toast(`${b.ref} deleted`);
    } catch (e) {
      toastError(e);
    }
  };

  const onBulkDelete = async () => {
    const n = selected.size;
    if (!(await confirm({ title: `Delete ${n} booking(s)?`, message: 'The selected bookings will be permanently deleted.', confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await deleteBookings([...selected]);
      setSelected(new Set());
      toast(`${n} booking(s) deleted`);
    } catch (e) {
      toastError(e);
    }
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const shown = paginate(rows, page, perPage);

  return (
    <Screen>
      <PageHeader
        title="Bookings"
        description="Manage event bookings, payments, and attendee data"
        actions={canWrite ? <Button title="New booking" icon={Plus} onPress={() => router.push('/bookings/new')} /> : null}
      />
      <Tabs tabs={[{ value: 'all', label: 'All bookings' }, { value: 'analytics', label: 'Analytics' }]} value={tab} onChange={setTab} />
      {tab === 'analytics' ? (
        <BookingsAnalytics />
      ) : (
        <>
          <Card>
            <Select label="Filter by Event" value={f.eventId} onChange={(v) => upd({ eventId: v })} searchable options={[{ value: 'all', label: 'All Events' }, ...events.map((e) => ({ value: e.id, label: eventFilterLabel(e) }))]} />
            <SearchInput value={f.q} onChange={(v) => upd({ q: v })} placeholder="Search by name, email, or booking ref..." />
            <Row>
              <Button small variant="secondary" icon={SlidersHorizontal} title={showFilters ? 'Hide filters' : 'Filters'} onPress={() => setShowFilters((x) => !x)} />
              <Button small variant="secondary" icon={Download} title="Export" onPress={() => exportCsv(rows)} />
            </Row>
            {showFilters ? (
              <View style={{ marginTop: 12 }}>
                <Checkbox label={`⚠ Show Duplicate Registrations Only (${dupSet.size})`} helper="Same email booked onto the same event" checked={f.duplicatesOnly} onChange={(v) => upd({ duplicatesOnly: v })} />
                <Select label="Status" value={f.status} onChange={(v) => upd({ status: v as BookingFilters['status'] })} options={enumOpts('All Statuses', BOOKING_STATUS_LABELS)} />
                <Select label="Payment Status" value={f.paymentStatus} onChange={(v) => upd({ paymentStatus: v as BookingFilters['paymentStatus'] })} options={enumOpts('All Payment Status', PAYMENT_STATUS_LABELS)} />
                <Row>
                  <View style={{ flex: 1 }}>
                    <DateField label="Start Date" value={f.startDate} onChange={(v) => upd({ startDate: v })} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <DateField label="End Date" value={f.endDate} onChange={(v) => upd({ endDate: v })} />
                  </View>
                </Row>
                <Select
                  label="Sort By"
                  value={f.sort}
                  onChange={(v) => upd({ sort: v })}
                  options={[
                    { value: 'created_desc', label: 'Created Date (Newest)' },
                    { value: 'created_asc', label: 'Created Date (Oldest)' },
                    { value: 'event_desc', label: 'Event Date (Latest)' },
                    { value: 'event_asc', label: 'Event Date (Earliest)' },
                  ]}
                />
                <Button title="Clear filters" variant="ghost" onPress={() => upd({ ...DEFAULT_BOOKING_FILTERS })} />
              </View>
            ) : null}
          </Card>

          {selected.size ? (
            <Card style={{ backgroundColor: c.primarySoft, borderColor: c.primary }}>
              <Row wrap style={{ justifyContent: 'space-between' }}>
                <Txt v="label">{selected.size} selected</Txt>
                <Row>
                  <Button small variant="ghost" title="Clear" onPress={() => setSelected(new Set())} />
                  <Button small variant="secondary" title="Export CSV" onPress={() => exportCsv(bookings.filter((b) => selected.has(b.id)))} />
                  {canDelete ? <Button small variant="danger" title="Delete" onPress={onBulkDelete} /> : null}
                </Row>
              </Row>
            </Card>
          ) : null}

          {rows.length === 0 ? <EmptyState title="No bookings match" body="Change the filters or search for a different name." /> : null}
          <View style={{ gap: 8 }}>
            {shown.map((b) => {
              const e = eventsById.get(b.eventId);
              const d = e?.dates.find((x) => x.id === b.eventDateId) ?? e?.dates[0];
              const on = selected.has(b.id);
              return (
                <ListRow key={b.id} selected={on} onPress={() => router.push(`/bookings/${b.id}`)}>
                  <Row style={{ alignItems: 'flex-start' }}>
                    <Pressable onPress={() => toggle(b.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`Select ${b.ref}`} hitSlop={8}>
                      <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: on ? c.primary : c.textFaint, backgroundColor: on ? c.primary : 'transparent', marginTop: 2 }} />
                    </Pressable>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <Txt v="label">{b.ref}</Txt>
                        <Txt v="faint">{shortDate(b.createdAt)}</Txt>
                      </Row>
                      <Txt v="small">
                        {b.customer.fullName} · <Text style={{ color: c.textMuted }}>{b.customer.email}</Text>
                      </Txt>
                      <Txt v="faint" numberOfLines={1}>
                        {e?.title ?? 'Deleted event'}
                        {d ? ` · ${eventDateLine(d.date, d.startTime)}` : ''}
                      </Txt>
                    </View>
                  </Row>
                  <Row wrap gap={6}>
                    <StatusPill value={b.status} label={BOOKING_STATUS_LABELS[b.status]} />
                    <StatusPill value={b.paymentStatus} label={PAYMENT_STATUS_LABELS[b.paymentStatus]} />
                    <Txt v="faint">
                      {b.attendees} attendee{b.attendees === 1 ? '' : 's'}
                    </Txt>
                    {b.emailsSent ? (
                      <Row gap={3}>
                        <Mail size={12} color={c.textFaint} />
                        <Txt v="faint">{b.emailsSent} emails</Txt>
                      </Row>
                    ) : null}
                    {b.smsSent ? (
                      <Row gap={3}>
                        <MessageSquare size={12} color={c.textFaint} />
                        <Txt v="faint">{b.smsSent} SMS</Txt>
                      </Row>
                    ) : null}
                    {dupSet.has(b.id) ? <TriangleAlert size={14} color={tones.amber.fg} /> : null}
                  </Row>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View>
                      <Txt v="label">{money(b.total, b.currency)}</Txt>
                      {b.discountAmount > 0 ? (
                        <Txt v="faint">
                          <Text style={{ textDecorationLine: 'line-through' }}>{money(b.total + b.discountAmount, b.currency)}</Text> {b.discountLabel}
                        </Txt>
                      ) : null}
                    </View>
                    <Row gap={0}>
                      {canWrite ? <IconButton icon={Pencil} label={`Edit ${b.ref}`} onPress={() => router.push(`/bookings/${b.id}/edit`)} size={18} /> : null}
                      {canDelete ? <IconButton icon={Trash2} label={`Delete ${b.ref}`} onPress={() => onDelete(b)} size={18} /> : null}
                    </Row>
                  </Row>
                </ListRow>
              );
            })}
          </View>
          <Pager page={page} perPage={perPage} total={rows.length} onPage={setPage} onPerPage={(n) => { setPerPage(n); setPage(1); }} showGoTo />

        </>
      )}
    </Screen>
  );
}
