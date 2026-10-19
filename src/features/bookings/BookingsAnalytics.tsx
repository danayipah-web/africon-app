import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { DateField, Select } from '@/components/form';
import { Card, Row, SectionTitle, StatCard, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import { eventFilterLabel } from '@/domain/eventLabels';
import type { Booking } from '@/domain/types';
import { compactMoney } from '@/lib/format';
import { PAYMENT_METHOD_LABELS } from '@/lib/labels';
import { space, useTheme } from '@/theme';

const DAY = 864e5;

function pct(cur: number, prev: number) {
  if (prev === 0) return cur === 0 ? '0%' : '+∞';
  const p = Math.round(((cur - prev) / prev) * 100);
  return `${p >= 0 ? '+' : ''}${p}%`;
}

const paid = (b: Booking) => b.paymentStatus === 'completed' || b.paymentStatus === 'partially_refunded';
const revenue = (xs: Booking[]) => xs.filter(paid).reduce((s, b) => s + (b.currency === 'GHS' ? b.amountPaid : 0), 0);

/** Bookings › Analytics, with the date-range and event filters the web admin lacks (spec §5.3, §14.4). */
export function BookingsAnalytics() {
  const { c } = useTheme();
  const bookings = useDb((s) => s.bookings);
  const events = useDb((s) => s.events);
  const [range, setRange] = useState('30');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [eventId, setEventId] = useState('all');
  const [now] = useState(() => Date.now());

  const data = useMemo(() => {
    let start: number;
    let end: number;
    if (range === 'custom' && from) {
      start = Date.parse(`${from}T00:00:00Z`);
      end = to ? Date.parse(`${to}T23:59:59Z`) : now;
    } else {
      const days = Number(range === 'custom' ? 30 : range);
      end = now;
      start = now - days * DAY;
    }
    const len = end - start;
    const inEvent = eventId === 'all' ? bookings : bookings.filter((b) => b.eventId === eventId);
    const cur = inEvent.filter((b) => {
      const t = Date.parse(b.createdAt);
      return t >= start && t <= end;
    });
    const prev = inEvent.filter((b) => {
      const t = Date.parse(b.createdAt);
      return t >= start - len && t < start;
    });
    const count = (xs: Booking[], f: (b: Booking) => boolean) => xs.filter(f).length;
    const byMethod = new Map<string, number>();
    for (const b of cur) byMethod.set(PAYMENT_METHOD_LABELS[b.paymentMethod], (byMethod.get(PAYMENT_METHOD_LABELS[b.paymentMethod]) ?? 0) + 1);
    const byEvent = new Map<string, Booking[]>();
    for (const b of cur) byEvent.set(b.eventId, [...(byEvent.get(b.eventId) ?? []), b]);
    const top = [...byEvent.entries()]
      .map(([id, bs]) => ({ title: events.find((e) => e.id === id)?.title ?? 'Deleted event', bookings: bs.length, attendees: bs.reduce((s, b) => s + b.attendees, 0), revenue: revenue(bs) }))
      .sort((a, b) => b.revenue - a.revenue || b.bookings - a.bookings)
      .slice(0, 5);
    const attendees = cur.filter((b) => b.status !== 'cancelled').reduce((s, b) => s + b.attendees, 0);
    const checkedIn = cur.filter((b) => b.checkedIn || b.status === 'completed').length;
    return {
      cur,
      prev,
      confirmed: count(cur, (b) => b.status === 'confirmed'),
      pending: count(cur, (b) => b.status === 'pending'),
      cancelled: count(cur, (b) => b.status === 'cancelled'),
      completed: count(cur, (b) => b.status === 'completed'),
      rev: revenue(cur),
      prevRev: revenue(prev),
      outstanding: cur.filter((b) => b.paymentStatus === 'pending' || b.paymentStatus === 'pay_later').reduce((s, b) => s + b.total, 0),
      attendees,
      confirmedAttendees: cur.filter((b) => b.status === 'confirmed' || b.status === 'completed').reduce((s, b) => s + b.attendees, 0),
      checkedIn,
      byMethod: [...byMethod.entries()].sort((a, b) => b[1] - a[1]),
      top,
    };
  }, [bookings, events, range, from, to, eventId, now]);

  const checkRate = data.cur.length ? Math.round((data.checkedIn / data.cur.length) * 100) : 0;

  return (
    <View style={{ gap: space.lg }}>
      <Card>
        <Select
          label="Date range"
          value={range}
          onChange={setRange}
          options={[
            { value: '7', label: 'Last 7 days' },
            { value: '30', label: 'Last 30 days' },
            { value: '90', label: 'Last 90 days' },
            { value: 'custom', label: 'Custom range' },
          ]}
        />
        {range === 'custom' ? (
          <Row>
            <View style={{ flex: 1 }}>
              <DateField label="From" value={from} onChange={setFrom} />
            </View>
            <View style={{ flex: 1 }}>
              <DateField label="To" value={to} onChange={setTo} />
            </View>
          </Row>
        ) : null}
        <Select label="Event" value={eventId} onChange={setEventId} searchable options={[{ value: 'all', label: 'All Events' }, ...events.map((e) => ({ value: e.id, label: eventFilterLabel(e) }))]} />
        <Txt v="faint">Compared with the previous period of the same length.</Txt>
      </Card>
      <Row gap={space.md}>
        <StatCard style={{ flex: 1 }} label="Total Bookings" value={String(data.cur.length)} sub={`${pct(data.cur.length, data.prev.length)} · ${data.confirmed} confirmed, ${data.pending} pending`} />
        <StatCard style={{ flex: 1 }} label="Total Revenue" value={compactMoney(data.rev)} sub={`${pct(data.rev, data.prevRev)} · GHS ${data.rev.toFixed(0)} collected`} accent={c.accent} />
      </Row>
      <Row gap={space.md}>
        <StatCard style={{ flex: 1 }} label="Total Attendees" value={String(data.attendees)} sub={`${data.confirmedAttendees} confirmed`} />
        <StatCard style={{ flex: 1 }} label="Check-in Rate" value={`${checkRate}%`} sub={`${data.checkedIn} checked in`} />
      </Row>
      <Card>
        <SectionTitle title="Booking Status" />
        {[
          ['Confirmed', data.confirmed],
          ['Pending', data.pending],
          ['Cancelled', data.cancelled],
          ['Completed', data.completed],
        ].map(([k, v]) => (
          <Bar key={k as string} label={k as string} value={v as number} max={data.cur.length} />
        ))}
      </Card>
      <Card>
        <SectionTitle title="Payment Methods" />
        {data.byMethod.length === 0 ? <Txt v="muted">No bookings in this period.</Txt> : null}
        {data.byMethod.map(([k, v]) => (
          <Bar key={k} label={k} value={v} max={data.cur.length} />
        ))}
      </Card>
      <Card>
        <SectionTitle title="Revenue Status" />
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt>Collected (payment completed)</Txt>
          <Txt v="label">GHS {data.rev.toFixed(2)}</Txt>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
          <Txt>Pending (payment outstanding)</Txt>
          <Txt v="label">GHS {data.outstanding.toFixed(2)}</Txt>
        </Row>
      </Card>
      <Card>
        <SectionTitle title="Top Events" />
        {data.top.map((t) => (
          <View key={t.title} style={{ paddingVertical: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="label" style={{ flex: 1 }}>
                {t.title}
              </Txt>
              <Txt v="label">GHS {t.revenue.toFixed(0)}</Txt>
            </Row>
            <Txt v="faint">
              {t.bookings} bookings • {t.attendees} attendees
            </Txt>
          </View>
        ))}
        {data.top.length === 0 ? <Txt v="muted">No bookings in this period.</Txt> : null}
      </Card>
      <Card>
        <SectionTitle title="Performance Trends" />
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt>Bookings Change</Txt>
          <Txt v="label">
            {pct(data.cur.length, data.prev.length)} ({data.cur.length} vs {data.prev.length} previous)
          </Txt>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
          <Txt>Revenue Change</Txt>
          <Txt v="label">{pct(data.rev, data.prevRev)}</Txt>
        </Row>
      </Card>
    </View>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const { c } = useTheme();
  const w = max ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <View style={{ paddingVertical: 5, gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="small">{label}</Txt>
        <Txt v="label">{value}</Txt>
      </Row>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.border }}>
        <View style={{ width: `${w}%`, height: 6, borderRadius: 3, backgroundColor: c.primary }} />
      </View>
    </View>
  );
}
