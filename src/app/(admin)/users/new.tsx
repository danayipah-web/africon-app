import { router } from 'expo-router';
import { useState } from 'react';

import { useCurrentUser } from '@/auth/session';
import { Select, TextField } from '@/components/form';
import { PageHeader, Screen } from '@/components/layout';
import { toast, toastError } from '@/components/overlays';
import { Button, Card, EmptyState, Row, SectionTitle, Txt } from '@/components/ui';
import { createUser } from '@/data/repo/users';
import { fieldErrors, userCreateSchema } from '@/domain/schemas';
import type { Role } from '@/domain/types';
import { can, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_PERMISSIONS } from '@/lib/rbac';

export default function NewUser() {
  const me = useCurrentUser();
  const [f, setF] = useState({ email: '', displayName: '', role: 'viewer' as Role, password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  if (!can(me, 'write:users')) return <EmptyState title="Not allowed" body="Only Admins can create users." />;

  const submit = async () => {
    const r = userCreateSchema.safeParse(f);
    if (!r.success) return setErrors(fieldErrors(r.error));
    setErrors({});
    setBusy(true);
    try {
      const u = await createUser(f);
      toast(`${u.displayName} can now sign in`);
      router.replace(`/users/${u.id}`);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <PageHeader title="Create New User" description="Add a new admin user to the system" />
      <Card>
        <SectionTitle title="New User Details" />
        <TextField label="Email Address" required value={f.email} onChange={(v) => set('email', v)} keyboardType="email-address" error={errors.email} />
        <TextField label="Display Name" required value={f.displayName} onChange={(v) => set('displayName', v)} error={errors.displayName} />
        <Select
          label="Role"
          required
          value={f.role}
          onChange={(v) => set('role', v)}
          options={(['admin', 'content_manager', 'viewer'] as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
        />
        {/* TODO(spec): invite-by-email (magic link) once an email provider is connected. */}
        <TextField label="Password" required secure value={f.password} onChange={(v) => set('password', v)} error={errors.password} helper="At least 8 characters" />
        <TextField label="Confirm Password" required secure value={f.confirmPassword} onChange={(v) => set('confirmPassword', v)} error={errors.confirmPassword} />
      </Card>
      <Card>
        <SectionTitle title="Role Permissions" sub={ROLE_DESCRIPTIONS[f.role]} />
        <Txt v="mono">{ROLE_PERMISSIONS[f.role].join('  ')}</Txt>
      </Card>
      <Row style={{ justifyContent: 'flex-end' }}>
        <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
        <Button title="Create User" onPress={submit} loading={busy} />
      </Row>
    </Screen>
  );
}
