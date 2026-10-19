import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { db, useDb } from '@/data/db';
import type { AdminUser } from '@/domain/types';

const KEY = 'africon-admin-session';

export async function hashPassword(email: string, password: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${email.trim().toLowerCase()}::${password}`);
}

interface SessionState {
  userId: string | null;
  ready: boolean;
}

export const useSession = create<SessionState>(() => ({ userId: null, ready: false }));

async function store(value: string | null) {
  try {
    if (value) await SecureStore.setItemAsync(KEY, value);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // SecureStore is unavailable on web; the session then lasts for the tab only.
  }
}

export async function restoreSession() {
  let userId: string | null = null;
  try {
    userId = await SecureStore.getItemAsync(KEY);
  } catch {
    userId = null;
  }
  const user = userId ? db.get().users.find((u) => u.id === userId) : undefined;
  useSession.setState({ userId: user && user.status === 'active' ? user.id : null, ready: true });
}

export async function signIn(email: string, password: string): Promise<AdminUser> {
  const e = email.trim().toLowerCase();
  const user = db.get().users.find((u) => u.email.toLowerCase() === e);
  const hash = await hashPassword(e, password);
  if (!user || user.passwordHash !== hash) throw new Error('Incorrect email or password.');
  if (user.status !== 'active') throw new Error('This account has been disabled. Ask an admin to re-enable it.');
  const now = new Date().toISOString();
  db.set((s) => ({ users: s.users.map((u) => (u.id === user.id ? { ...u, lastLoginAt: now } : u)) }));
  await store(user.id);
  useSession.setState({ userId: user.id });
  return user;
}

export async function signOut() {
  await store(null);
  useSession.setState({ userId: null });
}

/** Current signed-in user (non-reactive). */
export function currentUser(): AdminUser | null {
  const id = useSession.getState().userId;
  return id ? (db.get().users.find((u) => u.id === id) ?? null) : null;
}

/** Reactive current user for screens. Signs out automatically if the account is disabled. */
export function useCurrentUser(): AdminUser | null {
  const id = useSession((s) => s.userId);
  return useDb((s) => (id ? (s.users.find((u) => u.id === id) ?? null) : null));
}
