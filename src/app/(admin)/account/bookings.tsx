import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { useCurrentUser } from '@/auth/session';
import { SearchInput } from '@/components/form';
import { FilterChips, ListRow, PageHeader, Pager, paginate, Screen } from '@/components/layout';
import { confirm, toast, toastError } from '@/components/overlays';
import { Button, EmptyState, Row, StatusPill, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import { assignBooking, updateBookingStatus } from '@/data/repo/bookings';
import type { Booking, BookingStatus } from '@/domain/types';
import { matchesView, needsPayment, sessionDate, sortBySession, type MyBookingsView } from '@/features/account/myBookings';
import { eventDateLine, money, todayISODate } from '@/lib/format';
import { BOOKING_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/labels';
import { can } from '@/lib/rbac';
import { useTheme } from '@/theme';

const VIEWS: { value: MyBookingsView; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'payment', label: 'Needs payment' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All mine' },
  { value: 'unassigned', label: 'Unassigned' },
];

const EMPTY: Record<MyBookingsView, { title: string; body: string }> = {
  open: { title: 'Nothing open', body: 'No pending, confirmed or waitlisted bookings are assigned to you.' },
  payment: { title: 'No payments to chase', body: 'Every booking assigned to you is paid or free.' },
  upcoming: { title: 'No upcoming sessions', body: 'None of your bookings are for a session later than today.' },
  past: { title: 'No past bookings', body: 'Bookings for sessions that have happened show here.' },
  all: { title: 'No bookings assigned to you', body: 'Claim one from the Unassigned queue, or ask a teammate to assign one.' },
  unassigned: { title: 'Queue is empty', body: 'Every booking has someone looking after it.' },
};

export default function MyBookings() {
  const { c } = useTheme();
  const me = useCurrentUser();
  const bookings = useDb((s) => s.bookings);
  const events = useDb((s) => s.events);
  const [view, setView] = useState<MyBookingsView>('open');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(me?.prefs.bookingsPerPage ?? 30);
  const [today] = useState(todayISODate);
  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const canWrite = can(me, 'write:bookings');

  const counts = useMemo(() => {
    const out = {} as Record<MyBookingsView, number>;
    for (const v of VIEWS) out[v.value] = me ? bookings.filter((b) => matchesView(b, v.value, me.id, eventsById, today)).length : 0;
    return out;
  }, [bookings, eventsById, me, today]);

  const rows = useMemo(() => {
    if (!me) return [];
    const s = q.trim().toLowerCase();
    const list = bookings.filter(
      (b) =>
        matchesView(b, view, me.id, eventsById, today) &&
        (!s || `${b.customer.fullName} ${b.customer.email} ${b.ref} ${eventsById.get(b.eventId)?.title ?? ''}`.toLowerCase().includes(s)),
    );
    return sortBySession(list, eventsById, today);
  }, [bookings, eventsById, me, q, today, view]);

  if (!me) return null;

  const run = async (fn: () => Promise<void>, msg: string) => {
    try {
      await fn();
      toast(msg);
    } catch (e) {
      toastError(e);
    }
  };

  const setStatus = (b: Booking, s: BookingStatus) => run(() => updateBookingStatus(b.id, s), `${b.ref}: ${BOOKING_STATUS_LABELS[s]}`);
  const claim = (b: Booking) => run(() => assignBooking(b.id, me.id), `${b.ref} assigned to you`);
  const release = async (b: Booking) => {
    const ok = await confirm({
      title: 'Unassign booking?',
      message: `${b.ref} goes back to the Unassigned queue so a teammate can pick it up.`,
      confirmLabel: 'Unassign',
    });
    if (ok) await run(() => assignBooking(b.id, null), `${b.ref} unassigned`);
  };

  const shown = paginate(rows, page, perPage);

  return (
    <Screen>
      <PageHeader
        title="My bookings"
        description="Bookings you look after. Confirm places, chase payments and pick up new ones from the queue."
        actions={<Button small variant="secondary" title="Open in Bookings" onPress={() => router.navigate({ pathname: '/bookings', params: { assignee: me.id } })} />}
      />
      <FilterChips
        value={view}
        onChange={(v) => {
          setView(v);
          setPage(1);
        }}
        chips={VIEWS.map((v) => ({ ...v, count: counts[v.value] }))}
      />
      <SearchInput
        value={q}
        onChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        placeholder="Search name, email, ref or event..."
      />

      {rows.length === 0 ? <EmptyState {...(q ? { title: 'No matches', body: 'Try a different name, email or booking ref.' } : EMPTY[view])} /> : null}

      <View style={{ gap: 8 }}>
        {shown.map((b) => {
          const e = eventsById.get(b.eventId);
          const d = e?.dates.find((x) => x.id === b.eventDateId) ?? e?.dates[0];
          const date = sessionDate(b, eventsById);
          const past = date !== '' && date < today;
          const owed = b.total - b.amountPaid;
          return (
            <ListRow key={b.id} onPress={() => router.push(`/bookings/${b.id}`)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="label">{b.ref}</Txt>
                <Txt v="faint">{d ? eventDateLine(d.date, d.startTime) : 'No date'}</Txt>
              </Row>
              <Txt v="small">
                {b.customer.fullName} · <Text style={{ color: c.textMuted }}>{b.customer.phone || b.customer.email}</Text>
              </Txt>
              <Txt v="faint" numberOfLines={1}>
                {e?.title ?? 'Deleted event'} · {b.attendees} attendee{b.attendees === 1 ? '' : 's'}
              </Txt>
              <Row wrap gap={6}>
                <StatusPill value={b.status} label={BOOKING_STATUS_LABELS[b.status]} />
                <StatusPill value={b.paymentStatus} label={PAYMENT_STATUS_LABELS[b.paymentStatus]} />
                {needsPayment(b) && owed > 0 ? <Txt v="faint">{money(owed, b.currency)} owed</Txt> : null}
              </Row>
              {canWrite ? (
                <Row wrap gap={6}>
                  {view === 'unassigned' ? (
                    <Button small title="Assign to me" onPress={() => claim(b)} />
                  ) : (
                    <>
                      {b.status === 'pending' || b.status === 'waitlist' ? <Button small title="Confirm" onPress={() => setStatus(b, 'confirmed')} /> : null}
                      {past && b.status === 'confirmed' ? (
                        <>
                          <Button small title="Attended" onPress={() => setStatus(b, 'completed')} />
                          <Button small variant="secondary" title="No-show" onPress={() => setStatus(b, 'no_show')} />
                        </>
                      ) : null}
                      <Button small variant="secondary" title="Edit" onPress={() => router.push(`/bookings/${b.id}/edit`)} />
                      <Button small variant="ghost" title="Unassign" onPress={() => release(b)} />
                    </>
                  )}
                </Row>
              ) : null}
            </ListRow>
          );
        })}
      </View>
      {rows.length > perPage ? (
        <Pager
          page={page}
          perPage={perPage}
          total={rows.length}
          onPage={setPage}
          onPerPage={(n) => {
            setPerPage(n);
            setPage(1);
          }}
        />
      ) : null}
    </Screen>
  );
}
