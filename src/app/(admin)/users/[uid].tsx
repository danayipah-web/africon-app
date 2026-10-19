import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useCurrentUser } from '@/auth/session';
import { ActivityFeed } from '@/components/ActivityFeed';
import { Checkbox, Select, TextField } from '@/components/form';
import { PageHeader, Screen } from '@/components/layout';
import { confirm, toast, toastError } from '@/components/overlays';
import { Button, Card, EmptyState, KeyValue, Pill, Row, SectionTitle, StatusPill, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import { setUserStatus, updateUser } from '@/data/repo/users';
import type { Capability, Role } from '@/domain/types';
import { dateTime } from '@/lib/format';
import { can, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_PERMISSIONS } from '@/lib/rbac';

export default function UserDetail() {
  const { uid, edit } = useLocalSearchParams<{ uid: string; edit?: string }>();
  const me = useCurrentUser();
  const user = useDb((s) => s.users.find((u) => u.id === uid));
  const audit = useDb((s) => s.audit);
  const [editing, setEditing] = useState(edit === '1');
  const [form, setForm] = useState({ displayName: user?.displayName ?? '', role: (user?.role ?? 'viewer') as Role, capabilities: user?.capabilities ?? [] });
  const canWrite = can(me, 'write:users');

  if (!user) return <EmptyState title="User not found" body="It may have been removed." />;

  const startEdit = () => {
    setForm({ displayName: user.displayName, role: user.role, capabilities: user.capabilities });
    setEditing(true);
  };

  const save = async () => {
    try {
      await updateUser(user.id, form);
      toast('Changes saved');
      setEditing(false);
    } catch (e) {
      toastError(e);
    }
  };

  const toggleStatus = async () => {
    const disabling = user.status === 'active';
    const ok = await confirm({
      title: disabling ? 'Disable user?' : 'Enable user?',
      message: disabling
        ? `${user.displayName} (${user.email}) will be signed out and can no longer sign in.`
        : `${user.displayName} (${user.email}) will be able to sign in again.`,
      confirmLabel: disabling ? 'Disable User' : 'Enable User',
      destructive: disabling,
    });
    if (!ok) return;
    try {
      await setUserStatus(user.id, disabling ? 'disabled' : 'active');
      toast(disabling ? 'User disabled' : 'User enabled');
    } catch (e) {
      toastError(e);
    }
  };

  const toggleCap = (cap: Capability, on: boolean) =>
    setForm((f) => ({ ...f, capabilities: on ? [...f.capabilities, cap] : f.capabilities.filter((x) => x !== cap) }));

  return (
    <Screen>
      <PageHeader
        title={user.displayName}
        description={user.email}
        actions={
          canWrite && !editing ? (
            <>
              <Button title="Edit User" onPress={startEdit} />
              <Button
                title={user.status === 'active' ? 'Disable User' : 'Enable User'}
                variant={user.status === 'active' ? 'danger' : 'secondary'}
                onPress={toggleStatus}
                disabled={user.id === me?.id}
              />
            </>
          ) : null
        }
      />
      {editing ? (
        <Card>
          <SectionTitle title="Edit user" />
          <TextField label="Display Name" required value={form.displayName} onChange={(v) => setForm((f) => ({ ...f, displayName: v }))} />
          <Select
            label="Role"
            value={form.role}
            onChange={(v) => setForm((f) => ({ ...f, role: v }))}
            options={(['admin', 'content_manager', 'viewer'] as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r], sub: ROLE_DESCRIPTIONS[r] }))}
          />
          <Txt v="label">Extra capabilities</Txt>
          <Checkbox label="Finance" helper="Can issue complimentary seats" checked={form.capabilities.includes('finance')} onChange={(v) => toggleCap('finance', v)} />
          <Checkbox label="Refunds" helper="Can refund and give complimentary private sessions" checked={form.capabilities.includes('refunds')} onChange={(v) => toggleCap('refunds', v)} />
          <Row style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            <Button title="Cancel" variant="secondary" onPress={() => setEditing(false)} />
            <Button title="Save Changes" onPress={save} />
          </Row>
        </Card>
      ) : null}
      <Card>
        <SectionTitle title="Basic Information" />
        <KeyValue label="Email" value={user.email} />
        <KeyValue label="Display Name" value={user.displayName} />
        <KeyValue label="User ID" value={user.id} />
      </Card>
      <Card>
        <SectionTitle title="Role & Status" />
        <KeyValue label="Role">
          <Pill label={ROLE_LABELS[user.role]} tone="blue" />
        </KeyValue>
        <KeyValue label="Status">
          <StatusPill value={user.status} label={user.status === 'active' ? 'Active' : 'Disabled'} />
        </KeyValue>
        <KeyValue label="Capabilities" value={user.capabilities.length ? user.capabilities.join(', ') : 'None'} />
      </Card>
      <Card>
        <SectionTitle title="Account Activity" />
        <KeyValue label="Account Created" value={dateTime(user.createdAt)} />
        <KeyValue label="Last Login" value={user.lastLoginAt ? dateTime(user.lastLoginAt) : 'Never'} />
      </Card>
      <Card>
        <SectionTitle title="Permissions" />
        <Txt v="mono">{ROLE_PERMISSIONS[user.role].join('\n')}</Txt>
      </Card>
      <Card>
        <SectionTitle title="Activity" sub="Actions by this user" />
        <ActivityFeed entries={audit.filter((a) => a.actorEmail === user.email)} absoluteTime />
      </Card>
    </Screen>
  );
}
