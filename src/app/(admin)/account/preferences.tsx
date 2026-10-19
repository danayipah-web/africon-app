import { useCurrentUser } from '@/auth/session';
import { RadioGroup, Select, SwitchRow } from '@/components/form';
import { Screen } from '@/components/layout';
import { toastError } from '@/components/overlays';
import { Card, SectionTitle, SimNote } from '@/components/ui';
import { updatePrefs } from '@/data/repo/account';
import type { UserPrefs } from '@/domain/types';
import { useThemePref } from '@/theme';

type NotifKey = keyof UserPrefs['notifications'];

const NOTIFICATIONS: { key: NotifKey; label: string; helper: string }[] = [
  { key: 'assignedToMe', label: 'Booking assigned to me', helper: 'When a teammate hands you a booking' },
  { key: 'newBooking', label: 'New bookings', helper: 'Every new booking from the website or office' },
  { key: 'paymentFailed', label: 'Failed payments', helper: 'On bookings assigned to you' },
  { key: 'dailyDigest', label: 'Daily digest', helper: "Each morning: today's sessions and unpaid bookings" },
  { key: 'weeklyReport', label: 'Weekly report', helper: 'Monday summary of bookings and revenue' },
];

export default function Preferences() {
  const me = useCurrentUser();
  const mode = useThemePref((s) => s.mode);
  const setMode = useThemePref((s) => s.setMode);

  if (!me) return null;
  const p = me.prefs;

  const save = (patch: Partial<UserPrefs>) => updatePrefs(patch).catch(toastError);

  return (
    <Screen>
      <Card>
        <SectionTitle title="Email notifications" sub={`Sent to ${me.email}`} />
        {NOTIFICATIONS.map((n) => (
          <SwitchRow
            key={n.key}
            label={n.label}
            helper={n.helper}
            value={p.notifications[n.key]}
            onChange={(v) => save({ notifications: { ...p.notifications, [n.key]: v } })}
          />
        ))}
        <SimNote text="Test build: your choices are saved, but no emails are sent." />
      </Card>

      <Card>
        <SectionTitle title="Bookings" />
        <RadioGroup
          label="Bookings opens on"
          value={p.bookingsScope}
          onChange={(v) => save({ bookingsScope: v })}
          options={[
            { value: 'all', label: 'All bookings' },
            { value: 'mine', label: 'Assigned to me' },
          ]}
        />
        <Select
          label="Rows per page"
          value={String(p.bookingsPerPage)}
          onChange={(v) => save({ bookingsPerPage: Number(v) as UserPrefs['bookingsPerPage'] })}
          options={['10', '30', '50', '100'].map((n) => ({ value: n, label: n }))}
        />
      </Card>

      <Card>
        <SectionTitle title="Appearance" sub="Applies to this phone" />
        <RadioGroup
          value={mode}
          onChange={setMode}
          options={[
            { value: 'system', label: 'Match the phone' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Card>
    </Screen>
  );
}
