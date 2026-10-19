import { router } from 'expo-router';
import { CalendarClock, ClipboardList, CreditCard, History, KeyRound, LogOut, SlidersHorizontal, Ticket, UserRoundPen } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { signOut, useCurrentUser } from '@/auth/session';
import { Screen } from '@/components/layout';
import { confirm } from '@/components/overlays';
import { Avatar, Button, Card, Pill, Row, SectionTitle, StatCard, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import { MenuLink } from '@/features/account/MenuLink';
import { matchesView } from '@/features/account/myBookings';
import { dateTime, relativeTime, todayISODate } from '@/lib/format';
import { can, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/rbac';
import { space, useTheme } from '@/theme';

export default function AccountHome() {
  const { c } = useTheme();
  const me = useCurrentUser();
  const bookings = useDb((s) => s.bookings);
  const events = useDb((s) => s.events);
  const [today] = useState(todayISODate);
  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const counts = useMemo(() => {
    const n = (v: Parameters<typeof matchesView>[1]) => (me ? bookings.filter((b) => matchesView(b, v, me.id, eventsById, today)).length : 0);
    return { open: n('open'), payment: n('payment'), upcoming: n('upcoming'), unassigned: n('unassigned') };
  }, [bookings, eventsById, me, today]);

  if (!me) return null;

  const onSignOut = async () => {
    if (await confirm({ title: 'Sign out?', message: `Sign out of ${me.email}?`, confirmLabel: 'Sign out' })) await signOut();
  };

  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: space.sm }}>
        <Avatar name={me.displayName} size={72} />
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Txt v="h1" accessibilityRole="header">
            {me.displayName}
          </Txt>
          {me.jobTitle ? <Txt v="muted">{me.jobTitle}</Txt> : null}
          <Txt v="faint">{me.email}</Txt>
        </View>
        <Row gap={6}>
          <Pill label={ROLE_LABELS[me.role]} tone="blue" />
          {me.capabilities.map((cap) => (
            <Pill key={cap} label={cap === 'finance' ? 'Finance' : 'Refunds'} />
          ))}
        </Row>
        {me.bio ? (
          <Txt v="small" style={{ textAlign: 'center', color: c.textMuted }}>
            {me.bio}
          </Txt>
        ) : null}
        <Button title="Edit profile" icon={UserRoundPen} variant="secondary" small onPress={() => router.push('/account/edit')} />
      </Card>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <StatCard style={{ flex: 1 }} label="Open" value={String(counts.open)} sub="Assigned to you" icon={Ticket} />
        <StatCard style={{ flex: 1 }} label="Unpaid" value={String(counts.payment)} sub="Need follow-up" icon={CreditCard} accent={c.danger} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <StatCard style={{ flex: 1 }} label="Upcoming" value={String(counts.upcoming)} sub="Sessions ahead" icon={CalendarClock} />
        <StatCard style={{ flex: 1 }} label="Unassigned" value={String(counts.unassigned)} sub="Team queue" icon={ClipboardList} accent={c.textMuted} />
      </View>

      <Card padded={false} style={{ paddingHorizontal: space.lg }}>
        <MenuLink icon={Ticket} title="My bookings" sub="Bookings assigned to you, payments to chase" badge={counts.open ? String(counts.open) : undefined} onPress={() => router.push('/account/bookings')} />
        <MenuLink icon={UserRoundPen} title="Profile" sub="Name, job title, phone and bio" onPress={() => router.push('/account/edit')} />
        <MenuLink icon={KeyRound} title="Login & security" sub="Email, password and this device" onPress={() => router.push('/account/security')} />
        <MenuLink icon={SlidersHorizontal} title="Preferences" sub="Notifications, appearance and defaults" onPress={() => router.push('/account/preferences')} />
        <MenuLink icon={History} title="My activity" sub="Everything you changed in the back office" onPress={() => router.push('/account/activity')} last />
      </Card>

      <Card>
        <SectionTitle title="Your access" sub={ROLE_DESCRIPTIONS[me.role]} />
        <Row wrap gap={6}>
          <Pill label={can(me, 'write:bookings') ? 'Can manage bookings' : 'Bookings: view only'} tone={can(me, 'write:bookings') ? 'green' : 'grey'} />
          <Pill label={can(me, 'write:events') ? 'Can edit events' : 'Events: view only'} tone={can(me, 'write:events') ? 'green' : 'grey'} />
          <Pill label={can(me, 'write:users') ? 'Can manage users' : 'No user management'} tone={can(me, 'write:users') ? 'green' : 'grey'} />
        </Row>
        <Txt v="faint" style={{ marginTop: space.sm }}>
          Member since {dateTime(me.createdAt)} · Last sign-in {me.lastLoginAt ? relativeTime(me.lastLoginAt) : 'never'}
        </Txt>
        {!can(me, 'write:users') ? <Txt v="faint">Need more access? Ask an Admin to change your role.</Txt> : null}
      </Card>

      <Card padded={false} style={{ paddingHorizontal: space.lg }}>
        <MenuLink icon={LogOut} title="Sign out" onPress={onSignOut} danger last />
      </Card>
    </Screen>
  );
}
