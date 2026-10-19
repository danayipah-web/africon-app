import * as Device from 'expo-device';
import { Smartphone } from 'lucide-react-native';
import { useState } from 'react';
import { ZodError } from 'zod';

import { signOut, useCurrentUser } from '@/auth/session';
import { TextField } from '@/components/form';
import { Screen } from '@/components/layout';
import { confirm, toast, toastError } from '@/components/overlays';
import { Button, Card, KeyValue, Row, SectionTitle, SimNote, Txt } from '@/components/ui';
import { changeEmail, changePassword } from '@/data/repo/account';
import { fieldErrors } from '@/domain/schemas';
import { dateTime, relativeTime } from '@/lib/format';
import { useTheme } from '@/theme';

const blankPw = { currentPassword: '', newPassword: '', confirmPassword: '' };

/** 0–4 from length and character variety; only a hint, the rule is 8+ characters. */
function strength(pw: string) {
  if (!pw) return 0;
  let s = pw.length >= 8 ? 1 : 0;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];

export default function Security() {
  const { c, tones } = useTheme();
  const me = useCurrentUser();
  const [pw, setPw] = useState(blankPw);
  const [pwErr, setPwErr] = useState<Record<string, string>>({});
  const [em, setEm] = useState({ email: '', currentPassword: '' });
  const [emErr, setEmErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'pw' | 'email' | null>(null);

  if (!me) return null;

  const savePassword = async () => {
    setBusy('pw');
    try {
      await changePassword(pw);
      setPw(blankPw);
      setPwErr({});
      toast('Password changed');
    } catch (e) {
      if (e instanceof ZodError) setPwErr(fieldErrors(e));
      else setPwErr({ currentPassword: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const saveEmail = async () => {
    setBusy('email');
    try {
      await changeEmail(em);
      setEm({ email: '', currentPassword: '' });
      setEmErr({});
      toast('Email changed. Use it next time you sign in.');
    } catch (e) {
      if (e instanceof ZodError) setEmErr(fieldErrors(e));
      else if (e instanceof Error && /password/i.test(e.message)) setEmErr({ currentPassword: e.message });
      else toastError(e);
    } finally {
      setBusy(null);
    }
  };

  const onSignOut = async () => {
    if (await confirm({ title: 'Sign out?', message: `Sign out of ${me.email} on this phone?`, confirmLabel: 'Sign out' })) await signOut();
  };

  const score = strength(pw.newPassword);
  const scoreColor = score >= 3 ? tones.green.fg : score === 2 ? tones.amber.fg : c.danger;

  return (
    <Screen>
      <Card>
        <SectionTitle title="Password" sub={me.passwordChangedAt ? `Last changed ${relativeTime(me.passwordChangedAt)}` : 'Never changed since the account was created'} />
        <TextField label="Current Password" secure autoCapitalize="none" value={pw.currentPassword} onChange={(v) => setPw((x) => ({ ...x, currentPassword: v }))} error={pwErr.currentPassword} />
        <TextField
          label="New Password"
          secure
          autoCapitalize="none"
          value={pw.newPassword}
          onChange={(v) => setPw((x) => ({ ...x, newPassword: v }))}
          error={pwErr.newPassword}
          helper="At least 8 characters. Mix cases, numbers and symbols for a stronger password."
        />
        {pw.newPassword ? (
          <Txt v="faint" color={scoreColor} style={{ marginTop: -6, marginBottom: 8 }}>
            Strength: {STRENGTH[score]}
          </Txt>
        ) : null}
        <TextField label="Confirm New Password" secure autoCapitalize="none" value={pw.confirmPassword} onChange={(v) => setPw((x) => ({ ...x, confirmPassword: v }))} error={pwErr.confirmPassword} />
        <Row style={{ justifyContent: 'flex-end' }}>
          <Button title="Change password" onPress={savePassword} loading={busy === 'pw'} disabled={!pw.currentPassword || !pw.newPassword} />
        </Row>
      </Card>

      <Card>
        <SectionTitle title="Sign-in email" sub={`You sign in as ${me.email}`} />
        <TextField label="New Email" keyboardType="email-address" value={em.email} onChange={(v) => setEm((x) => ({ ...x, email: v }))} error={emErr.email} placeholder="name@africon.ai" />
        <TextField label="Current Password" secure autoCapitalize="none" value={em.currentPassword} onChange={(v) => setEm((x) => ({ ...x, currentPassword: v }))} error={emErr.currentPassword} helper="Confirms it's you" />
        <Row style={{ justifyContent: 'flex-end' }}>
          <Button title="Change email" variant="secondary" onPress={saveEmail} loading={busy === 'email'} disabled={!em.email || !em.currentPassword} />
        </Row>
      </Card>

      <Card>
        <SectionTitle title="This device" />
        <Row>
          <Smartphone size={18} color={c.primary} />
          <Txt v="label">{[Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || 'This phone'}</Txt>
        </Row>
        <KeyValue label="System" value={[Device.osName, Device.osVersion].filter(Boolean).join(' ')} />
        <KeyValue label="Signed in" value={me.lastLoginAt ? dateTime(me.lastLoginAt) : '—'} />
        <SimNote text="Test build: you stay signed in on this phone until you sign out, or an Admin disables your account." />
        <Button title="Sign out" variant="danger" onPress={onSignOut} style={{ marginTop: 12 }} />
      </Card>
    </Screen>
  );
}
