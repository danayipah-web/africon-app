import type { AdminUser, Capability, Role } from '@/domain/types';

export type Permission =
  | 'read:users'
  | 'write:users'
  | 'delete:users'
  | 'read:events'
  | 'write:events'
  | 'delete:events'
  | 'read:bookings'
  | 'write:bookings'
  | 'delete:bookings'
  | 'read:analytics'
  | 'manage:system';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'read:users',
    'write:users',
    'delete:users',
    'read:events',
    'write:events',
    'delete:events',
    'read:bookings',
    'write:bookings',
    'delete:bookings',
    'read:analytics',
    'manage:system',
  ],
  content_manager: ['read:events', 'write:events', 'read:bookings', 'write:bookings', 'read:analytics'],
  viewer: ['read:events', 'read:bookings', 'read:analytics'],
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  content_manager: 'Content Manager',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Full access to all system features including user management, events, bookings, and analytics.',
  content_manager: 'Can create and edit events, manage bookings, and view analytics but cannot manage other users.',
  viewer: 'Read-only access to events, bookings, and analytics data.',
};

export function can(user: Pick<AdminUser, 'role' | 'status'> | null | undefined, perm: Permission): boolean {
  if (!user || user.status !== 'active') return false;
  return ROLE_PERMISSIONS[user.role].includes(perm);
}

export function hasCapability(user: Pick<AdminUser, 'capabilities' | 'status'> | null | undefined, cap: Capability) {
  return !!user && user.status === 'active' && user.capabilities.includes(cap);
}

export class PermissionError extends Error {
  constructor(perm: string) {
    super(`You do not have permission to do this (${perm}).`);
    this.name = 'PermissionError';
  }
}

export function assertCan(user: AdminUser | null | undefined, perm: Permission) {
  if (!can(user, perm)) throw new PermissionError(perm);
}
