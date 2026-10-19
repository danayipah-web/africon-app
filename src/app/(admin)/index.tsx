import { router } from 'expo-router';
import {
  BarChart3,
  CalendarDays,
  CalendarPlus,
  Inbox,
  Send,
  Settings,
  Ticket,
  UserPlus,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { useCurrentUser } from '@/auth/session';
import { ActivityFeed } from '@/components/ActivityFeed';
import { PageHeader, Screen } from '@/components/layout';
import { Card, Row, SectionTitle, StatCard, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import { firstDate, lastDate } from '@/domain/defaults';
import { cedis, longToday, todayISODate } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

const QUICK: { title: string; desc: string; href: string; icon: LucideIcon }[] = [
  { title: 'Create event', desc: 'Add a new event to the calendar', href: '/events/new', icon: CalendarPlus },
  { title: 'Manage bookings', desc: 'Review and manage event bookings', href: '/bookings', icon: Ticket },
  { title: 'Add user', desc: 'Create a new admin user account', href: '/users/new', icon: UserPlus },
  { title: 'View analytics', desc: 'Check performance metrics and insights', href: '/soon/analytics', icon: BarChart3 },
  { title: 'Inquiries', desc: 'View and respond to inbound submissions', href: '/soon/inquiries', icon: Inbox },
  { title: 'CRM', desc: 'Customers and leads in one place', href: '/crm', icon: UsersRound },
  { title: 'Send campaign', desc: 'Email or SMS a customer/lead segment', href: '/crm/campaigns', icon: Send },
  { title: 'Settings', desc: 'Configure system settings and preferences', href: '/settings', icon: Settings },
];

export default function Dashboard() {
  const { c } = useTheme();
  const user = useCurrentUser();
  const bookings = useDb((s) => s.bookings);
  const events = useDb((s) => s.events);
  const audit = useDb((s) => s.audit);

  const m = useMemo(() => {
    const today = todayISODate();
    const paid = bookings.filter((b) => b.paymentStatus === 'completed' || b.paymentStatus === 'partially_refunded');
    const ghs = paid.filter((b) => b.currency === 'GHS').reduce((s, b) => s + b.amountPaid, 0);
    const usd = paid.filter((b) => b.currency === 'USD').reduce((s, b) => s + b.amountPaid, 0);
    const active = events.filter((e) => e.status === 'published' && (lastDate(e) || today) >= today);
    return {
      total: bookings.length,
      confirmed: bookings.filter((b) => b.status === 'confirmed').length,
      active: active.length,
      upcoming: active.filter((e) => firstDate(e) >= today).length,
      events: events.length,
      ghs,
      usd,
      paidCount: paid.length,
    };
  }, [bookings, events]);

  return (
    <Screen>
      <PageHeader title={`Welcome back, ${user?.displayName.split(' ')[0] ?? ''}`} description={`${longToday()} · Here's an overview of your platform.`} />

      <View style={{ gap: space.md }}>
        <Txt v="caps">Key metrics</Txt>
        <Row gap={space.md}>
          <StatCard style={{ flex: 1 }} label="Total bookings" value={m.total.toLocaleString()} sub={`${m.confirmed} confirmed`} icon={Ticket} accent="#2563EB" />
          <StatCard style={{ flex: 1 }} label="Active events" value={String(m.active)} sub={`${m.upcoming} upcoming · ${m.events} total`} icon={CalendarDays} accent="#16A34A" />
        </Row>
        <Row gap={space.md}>
          {/* Inquiries is an out-of-scope module: count shown read-only as 0 in the test build. */}
          <StatCard style={{ flex: 1 }} label="New inquiries" value="0" sub="0 total inquiries" icon={Inbox} accent="#D97706" />
          <StatCard
            style={{ flex: 1 }}
            label="Revenue"
            value={cedis(m.ghs)}
            sub={`${m.paidCount} paid bookings${m.usd ? ` · +$${m.usd.toLocaleString()}` : ''}`}
            icon={Wallet}
            accent={c.accent}
          />
        </Row>
      </View>

      <View style={{ gap: space.md }}>
        <Txt v="caps">Quick actions</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          {QUICK.map((q) => {
            const Icon = q.icon;
            return (
              <Pressable
                key={q.title}
                accessibilityRole="link"
                onPress={() => router.push(q.href as never)}
                style={({ pressed }) => ({
                  width: '47.5%',
                  backgroundColor: pressed ? c.cardAlt : c.card,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: radius.lg,
                  padding: space.md,
                  gap: 6,
                })}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} color={c.primary} />
                </View>
                <Txt v="label">{q.title}</Txt>
                <Txt v="faint">{q.desc}</Txt>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Card>
        <SectionTitle title="Recent activity" />
        <ActivityFeed entries={audit} />
      </Card>
    </Screen>
  );
}
