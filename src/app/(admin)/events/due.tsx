import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ListRow, PageHeader, Screen } from '@/components/layout';
import { Button, EmptyState, Pill, Row, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import { lastDate } from '@/domain/defaults';
import { relativeTime, todayISODate } from '@/lib/format';

interface DueItem {
  key: string;
  type: string;
  title: string;
  body: string;
  href: string;
  at: string;
}

/** Cross-event queue of things that need a person (spec §9.2), computed from bookings. */
export default function DueWork() {
  const events = useDb((s) => s.events);
  const bookings = useDb((s) => s.bookings);
  const [tick, setTick] = useState(0);

  const items = useMemo(() => {
    void tick;
    const today = todayISODate();
    const out: DueItem[] = [];
    const byId = new Map(events.map((e) => [e.id, e]));
    for (const b of bookings) {
      const e = byId.get(b.eventId);
      if (!e) continue;
      if (b.status === 'cancelled' && b.paymentStatus === 'completed') {
        out.push({ key: `r${b.id}`, type: 'REFUND WAITING', title: `${b.customer.fullName} · ${b.ref}`, body: `Cancelled but still marked paid on ${e.title}. Refund or reinstate.`, href: `/bookings/${b.id}`, at: b.createdAt });
      }
      if (b.paymentStatus === 'failed' && b.status !== 'cancelled') {
        out.push({ key: `f${b.id}`, type: 'PAYMENT FAILED', title: `${b.customer.fullName} · ${b.ref}`, body: `Payment failed for ${e.title}. Send a payment link or cancel.`, href: `/bookings/${b.id}`, at: b.createdAt });
      }
      if (b.paymentStatus === 'pay_later' && b.status !== 'cancelled' && e.registrationDeadline && e.registrationDeadline <= today) {
        out.push({ key: `h${b.id}`, type: 'HOLD ENDING', title: `${b.customer.fullName} · ${b.ref}`, body: `Pay-later hold on ${e.title} has reached the registration deadline.`, href: `/bookings/${b.id}`, at: b.createdAt });
      }
    }
    for (const e of events) {
      const end = lastDate(e);
      if (!end || end >= today || e.status === 'cancelled') continue;
      const unmarked = bookings.filter((b) => b.eventId === e.id && (b.status === 'confirmed' || b.status === 'pending'));
      if (unmarked.length) {
        out.push({ key: `u${e.id}`, type: 'REGISTER UNMARKED', title: e.title, body: `${unmarked.length} booking(s) not marked attended or no-show.`, href: `/events/${e.id}?tab=attendees`, at: `${end}T23:59:00Z` });
      }
    }
    return out.sort((a, b) => a.at.localeCompare(b.at));
  }, [events, bookings, tick]);

  return (
    <Screen>
      <PageHeader title="Due work" description="Holds about to end, payments that failed, refunds waiting and registers left unmarked." actions={<Button title="Refresh" variant="secondary" onPress={() => setTick((t) => t + 1)} />} />
      {items.length === 0 ? <EmptyState title="Nothing needs a person right now" body="New items appear here as bookings and events change." /> : null}
      <View style={{ gap: 8 }}>
        {items.map((it) => (
          <ListRow key={it.key} onPress={() => router.push(it.href as never)}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Pill label={it.type} tone={it.type.includes('FAILED') || it.type.includes('REFUND') ? 'red' : 'amber'} />
              <Txt v="faint">{relativeTime(it.at)}</Txt>
            </Row>
            <Txt v="label">{it.title}</Txt>
            <Txt v="muted">{it.body}</Txt>
          </ListRow>
        ))}
      </View>
    </Screen>
  );
}
