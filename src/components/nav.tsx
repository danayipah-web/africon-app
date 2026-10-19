import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { DrawerActions } from 'expo-router/react-navigation';
import { router, usePathname, useNavigation } from 'expo-router';
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  Handshake,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Moon,
  Percent,
  Presentation,
  Search,
  Settings,
  Sparkles,
  Star,
  Sun,
  Ticket,
  UserCog,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { signOut, useCurrentUser } from '@/auth/session';
import { ROLE_LABELS } from '@/lib/rbac';
import { radius, space, useTheme, useThemePref } from '@/theme';
import { confirm } from './overlays';
import { Avatar, IconButton, Row } from './ui';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Out-of-scope modules route to a "Coming soon" page (spec §0.6). */
  soon?: boolean;
}

/** Sidebar navigation, exact order and grouping from spec §2.2. */
export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'OVERVIEW',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
      { label: 'Analytics', href: '/soon/analytics', icon: BarChart3, soon: true },
    ],
  },
  {
    group: 'SALES & BOOKINGS',
    items: [
      { label: 'Bookings', href: '/bookings', icon: Ticket },
      { label: 'Ghana AI Summit 2026', href: '/soon/ghana-summit-2026', icon: Presentation, soon: true },
      { label: 'Conferences', href: '/soon/conferences', icon: Building2, soon: true },
      { label: 'Venue Bookings', href: '/soon/venue-bookings', icon: MapPin, soon: true },
    ],
  },
  {
    group: 'AIKASA',
    items: [
      { label: 'Waitlist', href: '/soon/aikasa-waitlist', icon: ListChecks, soon: true },
      { label: 'Founding Members', href: '/soon/aikasa-founding', icon: Star, soon: true },
    ],
  },
  {
    group: 'PEOPLE',
    items: [
      { label: 'CRM', href: '/crm', icon: UsersRound },
      { label: 'Users', href: '/users', icon: UserCog },
      { label: 'Affiliates', href: '/soon/affiliates', icon: Handshake, soon: true },
      { label: 'Facilitators', href: '/soon/facilitators', icon: Users, soon: true },
      { label: 'Consultations', href: '/soon/consultations', icon: MessageSquare, soon: true },
      { label: 'Inquiries', href: '/soon/inquiries', icon: Inbox, soon: true },
    ],
  },
  {
    group: 'CATALOG',
    items: [
      { label: 'Events & Trainings', href: '/events', icon: CalendarDays },
      { label: 'AI Sprints', href: '/soon/sprints', icon: Sparkles, soon: true },
      { label: 'Venues', href: '/soon/venues', icon: MapPin, soon: true },
      { label: 'Discounts', href: '/soon/discounts', icon: Percent, soon: true },
      { label: 'Project Briefs', href: '/soon/project-briefs', icon: FileText, soon: true },
    ],
  },
  {
    group: 'CONTENT',
    items: [
      { label: 'Content', href: '/soon/content', icon: BookOpen, soon: true },
      { label: 'Surveys', href: '/soon/surveys', icon: ClipboardList, soon: true },
    ],
  },
  { group: 'SETTINGS', items: [{ label: 'Settings', href: '/settings', icon: Settings }] },
];

export const SOON_LABELS: Record<string, string> = Object.fromEntries(
  NAV.flatMap((g) => g.items.filter((i) => i.soon).map((i) => [i.href.replace('/soon/', ''), i.label])),
);

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DrawerContent(props: DrawerContentComponentProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const user = useCurrentUser();

  const go = (href: string) => {
    props.navigation.closeDrawer();
    router.navigate(href as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.sidebar, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: space.lg, paddingVertical: space.lg }}>
        <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: 2 }}>AFRICON</Text>
        <Text style={{ color: c.sidebarText, fontSize: 11, letterSpacing: 3, fontWeight: '600' }}>ADMIN</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: space.lg }}>
        {NAV.map((g) => (
          <View key={g.group} style={{ marginBottom: space.sm }}>
            <Text style={{ color: c.sidebarText, opacity: 0.6, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, paddingHorizontal: space.lg, paddingVertical: 6 }}>
              {g.group}
            </Text>
            {g.items.map((it) => {
              const active = isActive(pathname, it.href);
              const Icon = it.icon;
              return (
                <Pressable
                  key={it.href}
                  accessibilityRole="link"
                  accessibilityState={{ selected: active }}
                  onPress={() => go(it.href)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    marginHorizontal: space.sm,
                    paddingHorizontal: space.md,
                    paddingVertical: 10,
                    borderRadius: radius.md,
                    backgroundColor: active ? c.sidebarActive : pressed ? 'rgba(255,255,255,0.06)' : 'transparent',
                  })}>
                  <Icon size={18} color={active ? '#FFFFFF' : c.sidebarText} />
                  <Text style={{ color: active ? '#FFFFFF' : c.sidebarText, fontWeight: active ? '700' : '500', flex: 1 }}>{it.label}</Text>
                  {it.soon ? <Text style={{ color: c.sidebarText, opacity: 0.5, fontSize: 10 }}>SOON</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
      {user ? (
        <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', padding: space.lg, paddingBottom: insets.bottom + space.md }}>
          <Row>
            <Avatar name={user.displayName} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }} numberOfLines={1}>
                {user.displayName}
              </Text>
              <Text style={{ color: c.sidebarText, fontSize: 12 }} numberOfLines={1}>
                {user.email} · {ROLE_LABELS[user.role]}
              </Text>
            </View>
            <IconButton
              icon={LogOut}
              label="Sign out"
              color={c.sidebarText}
              onPress={async () => {
                if (await confirm({ title: 'Sign out?', message: `Sign out of ${user.email}?`, confirmLabel: 'Sign out' })) {
                  props.navigation.closeDrawer();
                  await signOut();
                }
              }}
            />
          </Row>
        </View>
      ) : null}
    </View>
  );
}

export function MenuButton() {
  const nav = useNavigation();
  const { c } = useTheme();
  return <IconButton icon={Menu} label="Open navigation menu" color={c.text} onPress={() => nav.dispatch(DrawerActions.openDrawer())} />;
}

export function HeaderRight() {
  const { c, isDark } = useTheme();
  const setMode = useThemePref((s) => s.setMode);
  return (
    <Row gap={0} style={{ marginRight: 4 }}>
      <IconButton icon={Search} label="Search" color={c.text} onPress={() => router.push('/search')} />
      <IconButton icon={isDark ? Sun : Moon} label="Toggle dark mode" color={c.text} onPress={() => setMode(isDark ? 'light' : 'dark')} />
    </Row>
  );
}

export function useStackOptions() {
  const { c } = useTheme();
  return {
    headerStyle: { backgroundColor: c.card },
    headerTintColor: c.text,
    headerTitleStyle: { fontWeight: '700' as const, fontSize: 17 },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: c.bg },
    headerRight: () => <HeaderRight />,
  };
}

/** Options for a module's root screen: hamburger menu instead of a back arrow. */
export const rootScreen = (title: string) => ({ title, headerLeft: () => <MenuButton /> });

