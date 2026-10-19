import { db } from '@/data/db';
import type { AdminUser, AuditLog } from '@/domain/types';
import { newId } from '@/lib/ids';

const MAX_ENTRIES = 3000;

/** Write one audit entry. Every repository mutation calls this (spec §13 audit middleware). */
export function logAudit(
  actor: AdminUser | null,
  action: string,
  kind: AuditLog['kind'],
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {},
) {
  const entry: AuditLog = {
    id: newId(),
    actorEmail: actor?.email ?? 'system',
    actorRole: actor?.role ?? 'system',
    action,
    kind,
    entityType,
    entityId,
    details,
    at: new Date().toISOString(),
  };
  db.set((s) => ({ audit: [entry, ...s.audit].slice(0, MAX_ENTRIES) }));
  return entry;
}
