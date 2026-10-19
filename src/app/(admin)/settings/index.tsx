import { router } from 'expo-router';
import { CircleUserRound, Settings2, ShieldCheck, Smartphone, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { signOut, useCurrentUser } from '@/auth/session';
import { RadioGroup } from '@/components/form';
import { PageHeader, Screen } from '@/components/layout';
import { confirm, toast, toastError } from '@/components/overlays';
import { Button, Card, Row, Txt } from '@/components/ui';
import { resetDemoData } from '@/data/repo/settings';
import { can } from '@/lib/rbac';
import { space, useTheme, useThemePref } from '@/theme';

const SECTIONS: { title: string; desc: string; icon: LucideIcon; link?: { label: string; sub: string; href: string } }[] = [
  { title: 'Your account', desc: 'Profile, password, notifications and the bookings you look after', icon: CircleUserRound, link: { label: 'Open my account', sub: 'Profile and preferences', href: '/account' } },
  { title: 'General', desc: 'Taxonomy, defaults, and platform-wide preferences', icon: Settings2, link: { label: 'Event metadata', sub: 'Categories, formats, levels, and tags', href: '/settings/event-metadata' } },
  { title: 'Team & access', desc: 'Invite teammates and manage roles', icon: ShieldCheck, link: { label: 'Manage users', sub: 'Accounts, roles and permissions', href: '/users' } },
];

export default function SettingsHub() {
  const { c } = useTheme();
  const me = useCurrentUser();
  const mode = useThemePref((s) => s.mode);
  const setMode = useThemePref((s) => s.setMode);

  const reset = async () => {
    const ok = await confirm({
      title: 'Reset demo data?',
      message: 'Every event, booking, contact, segment, campaign and user change on this device is erased and the demo data is loaded again. You will be signed out. This cannot be undone.',
      confirmLabel: 'Reset everything',
      destructive: true,
    });
    if (!ok) return;
    try {
      await resetDemoData();
      await signOut();
      toast('Demo data restored');
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <Screen>
      <PageHeader title="Settings" description="Configure platform behavior, taxonomy, and integrations." />
      {SECTIONS.map((s) => {
        const Icon = s.icon;
        return (
          <Card key={s.title} style={{ gap: space.sm }}>
            <Row>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Row gap={6}>
                  <Txt v="h3">{s.title}</Txt>
                </Row>
                <Txt v="faint">{s.desc}</Txt>
              </View>
            </Row>
            {s.link ? (
              <Button
                title={s.link.label}
                variant="secondary"
                onPress={() => router.push(s.link!.href as never)}
                disabled={s.link.href === '/users' ? !can(me, 'read:users') : false}
              />
            ) : null}
          </Card>
        );
      })}
      <Card style={{ gap: space.sm }}>
        <Row>
          <Smartphone size={18} color={c.primary} />
          <Txt v="h3">This device</Txt>
        </Row>
        <RadioGroup
          label="Appearance"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'system', label: 'Match the phone' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <Txt v="faint">Test build: all data is stored on this phone only. Payments, email and SMS are simulated.</Txt>
        {can(me, 'manage:system') ? <Button title="Reset demo data" variant="danger" onPress={reset} /> : null}
      </Card>
    </Screen>
  );
}
