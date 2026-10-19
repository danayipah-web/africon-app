import { router, usePreventRemove } from 'expo-router';
import { useState } from 'react';
import { ZodError } from 'zod';

import { useCurrentUser } from '@/auth/session';
import { TextField } from '@/components/form';
import { Screen } from '@/components/layout';
import { confirm, toast, toastError } from '@/components/overlays';
import { Avatar, Button, Card, KeyValue, Row, SectionTitle, Txt } from '@/components/ui';
import { updateProfile } from '@/data/repo/account';
import { fieldErrors, type ProfileForm } from '@/domain/schemas';
import { ROLE_LABELS } from '@/lib/rbac';
import { space } from '@/theme';

export default function EditProfile() {
  const me = useCurrentUser();
  const [f, setF] = useState<ProfileForm>({
    displayName: me?.displayName ?? '',
    jobTitle: me?.jobTitle ?? '',
    phone: me?.phone ?? '',
    bio: me?.bio ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const disablePrevention = usePreventRemove(dirty, ({ repeat }) => {
    confirm({ title: 'Discard changes?', message: 'Your profile has unsaved changes.', confirmLabel: 'Discard', destructive: true }).then((ok) => {
      if (ok) {
        setDirty(false);
        repeat();
      }
    });
  });

  if (!me) return null;

  const set = (k: keyof ProfileForm) => (v: string) => {
    setDirty(true);
    setF((x) => ({ ...x, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile(f);
      disablePrevention();
      setDirty(false);
      toast('Profile saved');
      router.back();
    } catch (e) {
      if (e instanceof ZodError) setErrors(fieldErrors(e));
      else toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: space.sm }}>
        <Avatar name={f.displayName || me.displayName} size={64} />
        <Txt v="faint" style={{ textAlign: 'center' }}>
          Your initials are your avatar. Teammates see your name on bookings you look after and in the activity log.
        </Txt>
      </Card>
      <Card>
        <SectionTitle title="About you" />
        <TextField label="Display Name" required value={f.displayName} onChange={set('displayName')} error={errors.displayName} maxLength={60} autoCapitalize="words" />
        <TextField label="Job Title" optional value={f.jobTitle} onChange={set('jobTitle')} error={errors.jobTitle} maxLength={80} placeholder="e.g. Events Coordinator" autoCapitalize="words" />
        <TextField label="Phone" optional value={f.phone} onChange={set('phone')} error={errors.phone} keyboardType="phone-pad" placeholder="+233 24 123 4567" />
        <TextField label="Bio" optional multiline value={f.bio} onChange={set('bio')} error={errors.bio} maxLength={280} counter helper="Shown on your profile" />
      </Card>
      <Card>
        <SectionTitle title="Managed by an Admin" sub="Change your sign-in email under Login & security." />
        <KeyValue label="Email" value={me.email} />
        <KeyValue label="Role" value={ROLE_LABELS[me.role]} />
      </Card>
      <Row style={{ justifyContent: 'flex-end' }}>
        <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
        <Button title="Save profile" onPress={save} loading={saving} disabled={!dirty} />
      </Row>
    </Screen>
  );
}
