import { currentUser, hashPassword } from '@/auth/session';
import { db } from '@/data/db';
import { emailChangeSchema, passwordChangeSchema, profileSchema, type ProfileForm } from '@/domain/schemas';
import type { AdminUser, UserPrefs } from '@/domain/types';
import { logAudit } from './audit';

/**
 * Self-service account changes for the signed-in user. Every role may edit
 * its own profile, so these check for an active session, not a permission.
 */
function me(): AdminUser {
  const user = currentUser();
  if (!user || user.status !== 'active') throw new Error('You are signed out. Sign in again to continue.');
  return user;
}

function patchMe(id: string, patch: Partial<AdminUser>) {
  db.set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
}

export async function updateProfile(input: ProfileForm) {
  const user = me();
  const v = profileSchema.parse(input);
  const changed = (Object.keys(v) as (keyof ProfileForm)[]).filter((k) => v[k] !== user[k]);
  if (!changed.length) return;
  patchMe(user.id, v);
  logAudit(user, 'Updated own profile', 'write', 'user', user.id, { changed });
}

export async function changePassword(input: { currentPassword: string; newPassword: string; confirmPassword: string }) {
  const user = me();
  const v = passwordChangeSchema.parse(input);
  if ((await hashPassword(user.email, v.currentPassword)) !== user.passwordHash) throw new Error('Your current password is incorrect.');
  patchMe(user.id, { passwordHash: await hashPassword(user.email, v.newPassword), passwordChangedAt: new Date().toISOString() });
  logAudit(user, 'Changed own password', 'write', 'user', user.id, { email: user.email });
}

/** The sign-in email is part of the password hash, so changing it re-hashes with the confirmed password. */
export async function changeEmail(input: { email: string; currentPassword: string }) {
  const user = me();
  const v = emailChangeSchema.parse(input);
  const email = v.email.toLowerCase();
  if (email === user.email.toLowerCase()) throw new Error('That is already your email address.');
  if ((await hashPassword(user.email, v.currentPassword)) !== user.passwordHash) throw new Error('Your current password is incorrect.');
  if (db.get().users.some((u) => u.id !== user.id && u.email.toLowerCase() === email)) throw new Error('Another account already uses this email.');
  patchMe(user.id, { email, passwordHash: await hashPassword(email, v.currentPassword) });
  logAudit({ ...user, email }, 'Changed own email', 'write', 'user', user.id, { email: `${user.email} → ${email}` });
}

export async function updatePrefs(patch: Partial<UserPrefs>) {
  const user = me();
  const prefs: UserPrefs = {
    ...user.prefs,
    ...patch,
    notifications: { ...user.prefs.notifications, ...patch.notifications },
  };
  patchMe(user.id, { prefs });
  logAudit(user, 'Updated preferences', 'write', 'user', user.id, { changed: Object.keys(patch) });
}
