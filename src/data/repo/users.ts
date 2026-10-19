import { currentUser, hashPassword, signOut } from '@/auth/session';
import { db } from '@/data/db';
import { blankProfile } from '@/domain/defaults';
import { userCreateSchema } from '@/domain/schemas';
import type { AdminUser, Capability, Role } from '@/domain/types';
import { newId } from '@/lib/ids';
import { assertCan } from '@/lib/rbac';
import { logAudit } from './audit';

function activeAdmins(users: AdminUser[]) {
  return users.filter((u) => u.role === 'admin' && u.status === 'active');
}

export async function createUser(input: {
  email: string;
  displayName: string;
  role: Role;
  password: string;
  confirmPassword: string;
}) {
  const me = currentUser();
  assertCan(me, 'write:users');
  const v = userCreateSchema.parse(input);
  const email = v.email.toLowerCase();
  if (db.get().users.some((u) => u.email.toLowerCase() === email)) throw new Error('A user with this email already exists.');
  const user: AdminUser = {
    ...blankProfile(),
    id: newId(),
    email,
    displayName: v.displayName,
    role: v.role,
    capabilities: v.role === 'admin' ? ['finance', 'refunds'] : [],
    status: 'active',
    passwordHash: await hashPassword(email, v.password),
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };
  db.set((s) => ({ users: [...s.users, user] }));
  logAudit(me, 'Created user', 'write', 'user', user.id, { email, role: v.role });
  return user;
}

export async function updateUser(id: string, patch: { displayName: string; role: Role; capabilities: Capability[] }) {
  const me = currentUser();
  assertCan(me, 'write:users');
  const users = db.get().users;
  const target = users.find((u) => u.id === id);
  if (!target) throw new Error('User not found.');
  if (!patch.displayName.trim()) throw new Error('Display name is required.');
  if (target.role === 'admin' && patch.role !== 'admin' && target.status === 'active' && activeAdmins(users).length <= 1) {
    throw new Error('You cannot demote the last Admin.');
  }
  db.set((s) => ({
    users: s.users.map((u) =>
      u.id === id ? { ...u, displayName: patch.displayName.trim(), role: patch.role, capabilities: patch.capabilities } : u,
    ),
  }));
  logAudit(me, 'Updated user', 'write', 'user', id, {
    email: target.email,
    role: target.role === patch.role ? undefined : `${target.role} → ${patch.role}`,
  });
}

export async function setUserStatus(id: string, status: AdminUser['status']) {
  const me = currentUser();
  assertCan(me, 'write:users');
  const users = db.get().users;
  const target = users.find((u) => u.id === id);
  if (!target) throw new Error('User not found.');
  if (status === 'disabled') {
    if (me?.id === id) throw new Error('You cannot disable yourself.');
    if (target.role === 'admin' && activeAdmins(users).length <= 1) throw new Error('You cannot disable the last Admin.');
  }
  db.set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, status } : u)) }));
  logAudit(me, status === 'disabled' ? 'Disabled user' : 'Enabled user', 'write', 'user', id, { email: target.email });
  // Disabling revokes sessions: the session gate signs a disabled user out on their next render.
  if (status === 'disabled' && me?.id === id) await signOut();
}
