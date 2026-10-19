import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, View } from 'react-native';

import { useCurrentUser } from '@/auth/session';
import { Checkbox, MultiSelect, RadioGroup, TextField } from '@/components/form';
import { FilterChips, ListRow } from '@/components/layout';
import { confirm, toast, toastError } from '@/components/overlays';
import { Button, Card, EmptyState, KeyValue, Pill, Row, SectionTitle, SimNote, StatCard, StatusPill, Txt } from '@/components/ui';
import { sendEventMessage, updateBookingStatus } from '@/data/repo/bookings';
import { firstDate } from '@/domain/defaults';
import { dateEntryLabel } from '@/domain/eventLabels';
import type { Booking, EventItem } from '@/domain/types';
import { capacityFor, seatsTaken } from '@/lib/capacity';
import { toCsv } from '@/lib/csv';
import { dateTime, money, shortDate, todayISODate } from '@/lib/format';
import { BOOKING_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/labels';
import { can } from '@/lib/rbac';
import { shareCsv, stamp } from '@/lib/share';
import { space } from '@/theme';

// Groups used by Attendees, Orders and Messages (managed-checkout vocabulary mapped onto bookings).
export type Group = 'paid' | 'invoiced' | 'started' | 'cancelled' | 'attended' | 'no_show' | 'not_marked';

export function groupOf(b: Booking): Group[] {
  const out: Group[] = [];
  if (b.status === 'cancelled') out.push('cancelled');
  else if (b.paymentStatus === 'completed' || b.paymentStatus === 'not_required') out.push('paid');
  else if (b.paymentStatus === 'pay_later') out.push('invoiced');
  else out.push('started');
  if (b.status === 'completed' || b.checkedIn) out.push('attended');
  else if (b.status === 'no_show') out.push('no_show');
  else if (b.status !== 'cancelled') out.push('not_marked');
  return out;
}

const GROUP_LABELS: Record<Group, string> = {
  paid: 'Paid',
  invoiced: 'Invoiced',
  started: 'Started',
  cancelled: 'Cancelled',
  attended: 'Attended',
  no_show: 'No-show',
  not_marked: 'Not marked',
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function exportEventCsv(e: EventItem, list: Booking[]) {
  const csv = toCsv(
    list.map((b) => ({
      ref: b.ref,
      name: b.customer.fullName,
      email: b.customer.email,
      phone: b.customer.phone,
      company: b.customer.company,
      attendees: b.attendees,
      status: BOOKING_STATUS_LABELS[b.status],
      payment: PAYMENT_STATUS_LABELS[b.paymentStatus],
      total: b.total,
      paid: b.amountPaid,
      currency: b.currency,
      heardAbout: b.heardAbout,
      created: b.createdAt,
    })),
  );
  return shareCsv(`${e.slug}-bookings-${stamp()}.csv`, csv);
}

export function OverviewTab({ e, list }: { e: EventItem; list: Booking[] }) {
  const taken = seatsTaken(list, e.id);
  const paid = list.filter((b) => b.paymentStatus === 'completed');
  const outstanding = list.filter((b) => (b.paymentStatus === 'pay_later' || b.paymentStatus === 'pending') && b.status !== 'cancelled');
  const refunded = list.filter((b) => b.paymentStatus === 'refunded' || b.paymentStatus === 'partially_refunded');
  const today = todayISODate();
  const open = e.status === 'published' && (!e.registrationDeadline || e.registrationDeadline >= today) && taken < e.capacity;
  const sources = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of paid) m.set(b.heardAbout || 'Direct', (m.get(b.heardAbout || 'Direct') ?? 0) + b.attendees);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [paid]);
  const groups = list.flatMap(groupOf);
  const count = (g: Group) => groups.filter((x) => x === g).length;

  return (
    <>
      <Card>
        <SectionTitle title="Places" />
        <Txt v="h2">
          {taken} of {e.capacity} places taken
        </Txt>
        <Row wrap gap={6} style={{ marginTop: 6 }}>
          <Pill label={open ? 'Bookings open' : 'Bookings closed'} tone={open ? 'green' : 'grey'} />
          {e.registrationDeadline ? <Pill label={`Closes ${shortDate(e.registrationDeadline)}`} /> : null}
        </Row>
        <Txt v="faint" style={{ marginTop: 6 }}>
          {paid.length} paid · {outstanding.length} invoiced or pending · {Math.max(0, e.capacity - taken)} remaining
        </Txt>
      </Card>
      <Row gap={space.md}>
        <StatCard style={{ flex: 1 }} label="Paid" value={money(sum(paid.map((b) => b.amountPaid)), e.currency, 0)} />
        <StatCard style={{ flex: 1 }} label="Outstanding" value={money(sum(outstanding.map((b) => b.total)), e.currency, 0)} />
      </Row>
      <StatCard label="Refunded" value={money(sum(refunded.map((b) => b.total)), e.currency, 0)} sub={`${refunded.length} booking(s)`} />
      <Card>
        <SectionTitle title="Top sources" sub="Paid places by how people heard" />
        {sources.length === 0 ? <Txt v="muted">No paid places yet.</Txt> : null}
        {sources.map(([k, n]) => (
          <Row key={k} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
            <Txt>{k}</Txt>
            <Txt v="label">{n}</Txt>
          </Row>
        ))}
      </Card>
      <Card>
        <SectionTitle title="On the day" />
        <Txt>
          Attended {count('attended')} · No-show {count('no_show')} · Not marked {count('not_marked')}
        </Txt>
        {e.options.certificate ? <Txt v="faint">Certificates provided for this event</Txt> : null}
      </Card>
      <Card>
        <SectionTitle title="Bookings by Session" />
        {e.dates.map((d) => (
          <Row key={d.id} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
            <Txt v="small" style={{ flex: 1 }}>
              {dateEntryLabel(d)}
            </Txt>
            <Txt v="label">
              {seatsTaken(list, e.id, d.id)}/{capacityFor(e, d.id)}
            </Txt>
          </Row>
        ))}
        <Button title="View session bookings →" variant="ghost" onPress={() => router.push(`/bookings?eventId=${e.id}`)} />
      </Card>
      <Card>
        <SectionTitle title="Description" />
        <Txt>{e.description || '—'}</Txt>
        {e.tags.length ? (
          <Row wrap gap={6} style={{ marginTop: 8 }}>
            {e.tags.map((t) => (
              <Pill key={t} label={t} tone="blue" />
            ))}
          </Row>
        ) : null}
      </Card>
      <Card>
        <SectionTitle title="Recent Bookings" right={<Button small variant="ghost" title="View All" onPress={() => router.push(`/bookings?eventId=${e.id}`)} />} />
        {list.slice(0, 5).map((b) => (
          <ListRow key={b.id} onPress={() => router.push(`/bookings/${b.id}`)} style={{ marginBottom: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="label" style={{ flex: 1 }}>
                {b.customer.fullName}
              </Txt>
              <StatusPill value={b.status} label={BOOKING_STATUS_LABELS[b.status]} />
            </Row>
            <Txt v="faint">
              {b.ref} · {shortDate(b.createdAt)}
            </Txt>
          </ListRow>
        ))}
        {list.length === 0 ? <Txt v="muted">No bookings yet.</Txt> : null}
      </Card>
      <Card>
        <SectionTitle title="Quick Actions" />
        <View style={{ gap: 8 }}>
          <Button title="View Bookings" variant="secondary" onPress={() => router.push(`/bookings?eventId=${e.id}`)} />
          <Button title="View Public Page" variant="secondary" onPress={() => Linking.openURL(`https://africon.ai/events/${e.slug}`)} />
          <Button title="Export Data" variant="secondary" onPress={() => exportEventCsv(e, list).catch(toastError)} />
        </View>
      </Card>
      <Card>
        <SectionTitle title="Metadata" />
        <KeyValue label="Event ID" value={e.id} />
        <KeyValue label="Slug" value={`/events/${e.slug}`} />
        <KeyValue label="Created" value={dateTime(e.createdAt)} />
        <KeyValue label="Updated" value={dateTime(e.updatedAt)} />
        <KeyValue label="Timezone" value={e.timezone} />
      </Card>
    </>
  );
}

export function AttendeesTab({ e, list }: { e: EventItem; list: Booking[] }) {
  const me = useCurrentUser();
  const [chip, setChip] = useState<'paid' | 'invoiced' | 'started' | 'cancelled' | 'all'>('paid');
  const first = firstDate(e);
  const registerOpen = !!first && todayISODate() >= first;
  const rows = chip === 'all' ? list : list.filter((b) => groupOf(b).includes(chip));
  const canMark = can(me, 'write:bookings') && registerOpen;
  const mark = async (b: Booking, status: 'completed' | 'no_show') => {
    try {
      await updateBookingStatus(b.id, status);
      toast(`${b.customer.fullName} marked ${status === 'completed' ? 'attended' : 'no-show'}`);
    } catch (err) {
      toastError(err);
    }
  };
  return (
    <>
      <Card>
        <Txt>
          {sum(list.filter((b) => b.status !== 'cancelled').map((b) => b.attendees))} people have a place.{' '}
          {first ? `The register opens at ${e.dates[0]?.startTime ?? '09:00'} on ${shortDate(first)}.` : ''}
        </Txt>
        <Button title="Download" variant="secondary" small style={{ alignSelf: 'flex-start', marginTop: 8 }} onPress={() => exportEventCsv(e, rows).catch(toastError)} />
      </Card>
      <FilterChips
        value={chip}
        onChange={setChip}
        chips={(['paid', 'invoiced', 'started', 'cancelled'] as const)
          .map((g) => ({ value: g, label: GROUP_LABELS[g], count: list.filter((b) => groupOf(b).includes(g)).length }))
          .concat([{ value: 'all' as never, label: 'All', count: list.length }])}
      />
      {rows.length === 0 ? <EmptyState title="Nobody here" body="No bookings in this group." /> : null}
      {rows.map((b) => (
        <ListRow key={b.id} onPress={() => router.push(`/bookings/${b.id}`)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt v="label" style={{ flex: 1 }}>
              {b.customer.fullName}
              {b.attendees > 1 ? ` +${b.attendees - 1}` : ''}
            </Txt>
            <StatusPill value={b.status} label={BOOKING_STATUS_LABELS[b.status]} />
          </Row>
          <Txt v="faint">
            {b.customer.email} · {b.customer.company || 'No organisation'}
          </Txt>
          {canMark && b.status !== 'cancelled' ? (
            <Row>
              <Button small title="Attended" variant={b.status === 'completed' ? 'primary' : 'secondary'} onPress={() => mark(b, 'completed')} />
              <Button small title="No-show" variant={b.status === 'no_show' ? 'danger' : 'secondary'} onPress={() => mark(b, 'no_show')} />
            </Row>
          ) : null}
        </ListRow>
      ))}
    </>
  );
}

export function OrdersTab({ list }: { e: EventItem; list: Booking[] }) {
  const [chip, setChip] = useState<'all' | 'paid' | 'invoiced' | 'started'>('all');
  const rows = chip === 'all' ? list : list.filter((b) => groupOf(b).includes(chip));
  return (
    <>
      <Txt v="muted">Each order is one booker with one or more places.</Txt>
      <FilterChips
        value={chip}
        onChange={setChip}
        chips={[
          { value: 'all', label: 'All', count: list.length },
          ...(['paid', 'invoiced', 'started'] as const).map((g) => ({ value: g, label: GROUP_LABELS[g], count: list.filter((b) => groupOf(b).includes(g)).length })),
        ]}
      />
      {rows.map((b) => (
        <ListRow key={b.id} onPress={() => router.push(`/bookings/${b.id}`)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt v="label">{b.ref}</Txt>
            <StatusPill value={b.paymentStatus} label={PAYMENT_STATUS_LABELS[b.paymentStatus]} />
          </Row>
          <Txt v="small">
            {b.customer.fullName} · {b.attendees} place{b.attendees === 1 ? '' : 's'}
          </Txt>
          <Txt v="faint">
            {money(b.total, b.currency)} · {shortDate(b.createdAt)}
          </Txt>
        </ListRow>
      ))}
      {rows.length === 0 ? <EmptyState title="No orders" /> : null}
    </>
  );
}

const EVENT_TAGS = ['First name', 'Full name', 'Organisation', 'Job title', 'Programme title', 'Date', 'Time', 'Venue', 'Map link', 'Booking reference', 'Payment link', 'Certificate link'];

export function MessagesTab({ e, list }: { e: EventItem; list: Booking[] }) {
  const me = useCurrentUser();
  const [groups, setGroups] = useState<string[]>(['paid']);
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const recipients = list.filter((b) => groupOf(b).some((g) => groups.includes(g)));
  const allGroups: Group[] = ['paid', 'invoiced', 'started', 'attended', 'no_show', 'not_marked'];
  const send = async () => {
    if (!(await confirm({ title: 'Send message?', message: `Send this ${channel === 'email' ? 'email' : 'text message'} to ${recipients.length} booking(s) for "${e.title}"?`, confirmLabel: 'Send' }))) return;
    try {
      const n = await sendEventMessage(e.id, recipients.map((b) => b.id), channel, subject, body);
      toast(`Sent to ${n} people (simulated)`);
      setSubject('');
      setBody('');
    } catch (err) {
      toastError(err);
    }
  };
  return (
    <Card>
      <SimNote text="Test build: messages are recorded and counted but not delivered." />
      <View style={{ height: space.md }} />
      <MultiSelect
        label="Who gets it"
        values={groups}
        onChange={setGroups}
        options={allGroups.map((g) => ({ value: g, label: `${GROUP_LABELS[g]} (${list.filter((b) => groupOf(b).includes(g)).length})` }))}
        helper={`${recipients.length} booking(s) · one message per person`}
      />
      <RadioGroup
        label="Channel"
        value={channel}
        onChange={setChannel}
        options={[
          { value: 'email', label: 'Email' },
          { value: 'sms', label: 'Text message' },
        ]}
      />
      {channel === 'email' ? <TextField label="Subject" required value={subject} onChange={setSubject} /> : null}
      <TextField label="Message" required multiline value={body} onChange={setBody} />
      <Txt v="faint">Insert</Txt>
      <Row wrap gap={6} style={{ marginVertical: 6 }}>
        {EVENT_TAGS.map((t) => (
          <Button key={t} small variant="secondary" title={t} onPress={() => setBody((b) => `${b}{{${t}}}`)} />
        ))}
      </Row>
      <Button title="Send" onPress={send} disabled={!can(me, 'write:bookings') || !recipients.length} />
    </Card>
  );
}

export function AutomationsTab({ e }: { e: EventItem }) {
  const [enabled] = useState(true);
  const first = firstDate(e);
  return (
    <>
      <SimNote text="The automations engine (scheduled reminders, invoice holds, follow-ups) comes in a later build. These are the defaults this event will use." />
      <Card>
        <Checkbox label="Send messages automatically" checked={enabled} onChange={() => undefined} disabled />
        <Checkbox label="Send confirmation emails" helper="Buyer gets a receipt + calendar file" checked onChange={() => undefined} disabled />
      </Card>
      <Card>
        <SectionTitle title="Reminders" />
        <KeyValue label="A week before" value={`7 days before at 09:00 · email + text${first ? ` · ${shortDate(new Date(Date.parse(first) - 7 * 864e5).toISOString())}` : ''}`} />
        <KeyValue label="The day before" value={`1 day before at 15:00 · email + text${first ? ` · ${shortDate(new Date(Date.parse(first) - 864e5).toISOString())}` : ''}`} />
      </Card>
      <Card>
        <SectionTitle title="After the event" />
        <KeyValue label="Follow-up" value="Sent after the event ends" />
        <KeyValue label="Certificates" value={e.options.certificate ? 'Issued to people marked attended' : 'Not provided'} />
      </Card>
    </>
  );
}

export function SourcesTab({ list }: { e: EventItem; list: Booking[] }) {
  const rows = useMemo(() => {
    const m = new Map<string, Booking[]>();
    for (const b of list) {
      const k = b.discountCode ? `Code ${b.discountCode}` : b.source === 'Office' ? 'Office' : 'Direct';
      m.set(k, [...(m.get(k) ?? []), b]);
    }
    const total = sum(list.filter((b) => b.paymentStatus === 'completed').map((b) => b.amountPaid)) || 1;
    return [...m.entries()].map(([k, bs]) => {
      const received = sum(bs.filter((b) => b.paymentStatus === 'completed').map((b) => b.amountPaid));
      return {
        k,
        orders: bs.length,
        paidPlaces: sum(bs.filter((b) => b.paymentStatus === 'completed' || b.paymentStatus === 'not_required').map((b) => b.attendees)),
        cancelled: bs.filter((b) => b.status === 'cancelled').length,
        received,
        outstanding: sum(bs.filter((b) => b.paymentStatus === 'pending' || b.paymentStatus === 'pay_later').map((b) => b.total)),
        discounts: sum(bs.map((b) => b.discountAmount)),
        share: Math.round((received / total) * 100),
      };
    });
  }, [list]);
  const heard = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of list) m.set(b.heardAbout || 'Not answered', (m.get(b.heardAbout || 'Not answered') ?? 0) + b.attendees);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [list]);
  return (
    <>
      <Txt v="muted">Every booking is credited to the partner whose link or code it came through, or to Direct.</Txt>
      {rows.map((r) => (
        <Card key={r.k}>
          <SectionTitle title={r.k} right={<Pill label={`${r.share}%`} tone="blue" />} />
          <Txt v="small">
            {r.orders} orders · {r.paidPlaces} paid places · {r.cancelled} cancelled
          </Txt>
          <Txt v="faint">
            Received {r.received.toFixed(2)} · Outstanding {r.outstanding.toFixed(2)} · Discounts {r.discounts.toFixed(2)}
          </Txt>
        </Card>
      ))}
      <Card>
        <SectionTitle title="How people said they heard" />
        {heard.map(([k, n]) => (
          <Row key={k} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
            <Txt>{k}</Txt>
            <Txt v="label">{n}</Txt>
          </Row>
        ))}
      </Card>
    </>
  );
}

export function CertificatesTab({ e, list }: { e: EventItem; list: Booking[] }) {
  const attended = list.filter((b) => b.status === 'completed' || b.checkedIn);
  return (
    <>
      <Txt v="muted">A certificate follows the register: only people marked attended can have one. It is issued in the name on the booking.</Txt>
      {!e.options.certificate ? <SimNote text="This event does not provide certificates (Settings step of the event wizard)." /> : null}
      <Row gap={space.md}>
        <StatCard style={{ flex: 1 }} label="Marked attended" value={String(attended.length)} />
        <StatCard style={{ flex: 1 }} label="Waiting" value={String(e.options.certificate ? attended.length : 0)} />
      </Row>
      <SimNote text="Issuing, re-sending and withdrawing certificates (unique ID + QR) arrives with the automations engine." />
      {attended.map((b) => (
        <ListRow key={b.id}>
          <Txt v="label">{b.customer.fullName}</Txt>
          <Txt v="faint">{b.customer.email}</Txt>
        </ListRow>
      ))}
    </>
  );
}
