import { router } from 'expo-router';
import { Pencil, UserPlus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useCurrentUser } from '@/auth/session';
import { SearchInput, Select } from '@/components/form';
import { FilterChips, ListRow, PageHeader, Screen } from '@/components/layout';
import { Avatar, Button, Card, EmptyState, IconButton, Pill, Row, StatusPill, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import type { Role } from '@/domain/types';
import { dateTime, shortDate } from '@/lib/format';
import { can, ROLE_LABELS } from '@/lib/rbac';

export default function UsersList() {
  const me = useCurrentUser();
  const users = useDb((s) => s.users);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'all' | Role>('all');
  const [status, setStatus] = useState<'active' | 'disabled' | 'all'>('active');
  const [sortDesc, setSortDesc] = useState(true);
  const canWrite = can(me, 'write:users');

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users
      .filter((u) => (role === 'all' || u.role === role) && (status === 'all' || u.status === status))
      .filter((u) => !s || u.email.toLowerCase().includes(s) || u.displayName.toLowerCase().includes(s))
      .sort((a, b) => (sortDesc ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)));
  }, [users, q, role, status, sortDesc]);

  return (
    <Screen>
      <PageHeader
        title="User management"
        description="Admin team accounts, roles and access."
        actions={canWrite ? <Button title="Add user" icon={UserPlus} onPress={() => router.push('/users/new')} /> : null}
      />
      <Card>
        <SearchInput value={q} onChange={setQ} placeholder="Search users by email or name..." />
        <Select
          value={role}
          onChange={setRole}
          options={[
            { value: 'all', label: 'All Roles' },
            { value: 'admin', label: 'Admin' },
            { value: 'content_manager', label: 'Content Manager' },
            { value: 'viewer', label: 'Viewer' },
          ]}
        />
        <FilterChips
          value={status}
          onChange={setStatus}
          chips={[
            { value: 'active', label: 'Active', count: users.filter((u) => u.status === 'active').length },
            { value: 'disabled', label: 'Disabled', count: users.filter((u) => u.status === 'disabled').length },
            { value: 'all', label: 'All', count: users.length },
          ]}
        />
      </Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="h3">Users ({rows.length})</Txt>
        <Button small variant="ghost" title={`Created ${sortDesc ? '↓' : '↑'}`} onPress={() => setSortDesc((d) => !d)} />
      </Row>
      {rows.length === 0 ? <EmptyState title="No users match" body="Clear the search or change the role filter." /> : null}
      <View style={{ gap: 8 }}>
        {rows.map((u) => (
          <ListRow key={u.id} onPress={() => router.push(`/users/${u.id}`)}>
            <Row>
              <Avatar name={u.displayName} />
              <View style={{ flex: 1 }}>
                <Txt v="label" numberOfLines={1}>
                  {u.displayName}
                  {u.id === me?.id ? ' (you)' : ''}
                </Txt>
                <Txt v="faint" numberOfLines={1}>
                  {u.email}
                </Txt>
              </View>
              {canWrite ? <IconButton icon={Pencil} label={`Edit ${u.displayName}`} onPress={() => router.push(`/users/${u.id}?edit=1`)} /> : null}
            </Row>
            <Row wrap gap={6}>
              <Pill label={ROLE_LABELS[u.role]} tone="blue" />
              <StatusPill value={u.status} label={u.status === 'active' ? 'Active' : 'Disabled'} />
            </Row>
            <Txt v="faint">
              Created {shortDate(u.createdAt)} · Last login {u.lastLoginAt ? dateTime(u.lastLoginAt) : 'Never'}
            </Txt>
          </ListRow>
        ))}
      </View>
    </Screen>
  );
}
