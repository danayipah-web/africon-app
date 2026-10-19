import { currentUser, hashPassword } from '@/auth/session';
import { db, whenHydrated } from '@/data/db';
import { buildSeed } from '@/data/seed';
import { metadataOptionSchema } from '@/domain/schemas';
import type { EventMetadata } from '@/domain/types';
import { assertCan } from '@/lib/rbac';
import { logAudit } from './audit';

export type MetadataKey = keyof EventMetadata;

export const METADATA_TABS: { key: MetadataKey; label: string; caption: string; max?: number }[] = [
  { key: 'prerequisites', label: 'Prerequisites', caption: 'REQUIREMENTS OR PRIOR KNOWLEDGE NEEDED FOR EVENTS' },
  { key: 'tags', label: 'Tags', caption: 'LABELS FOR GROUPING AND SEARCHING EVENTS' },
  { key: 'included', label: "What's Included", caption: 'WHAT ATTENDEES RECEIVE WITH THEIR BOOKING' },
  { key: 'gains', label: 'Customer Gains', caption: 'WHAT CUSTOMERS WILL GAIN FROM ATTENDING' },
  { key: 'categories', label: 'Categories', caption: 'EVENT CATEGORIES SHOWN IN THE WIZARD AND FILTERS' },
  { key: 'formats', label: 'Formats', caption: 'DELIVERY FORMATS' },
  { key: 'levels', label: 'Levels', caption: 'AUDIENCE LEVEL OF AN EVENT' },
  { key: 'heardAboutSources', label: 'Heard-about sources', caption: 'OPTIONS FOR "HOW DID YOU HEAR ABOUT THIS?"' },
];

const dedupe = (list: string[]) => {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = x.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/** Add one or many options (bulk add = one per line). Returns how many were added and any rejects. */
export async function addMetadataOptions(key: MetadataKey, raw: string) {
  const me = currentUser();
  assertCan(me, 'manage:system');
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const ok: string[] = [];
  const rejected: string[] = [];
  for (const l of lines) {
    const r = metadataOptionSchema.safeParse(l);
    if (r.success) ok.push(r.data);
    else rejected.push(`${l.slice(0, 40)}: ${r.error.issues[0]?.message}`);
  }
  const before = db.get().metadata[key];
  const next = dedupe([...before, ...ok]);
  db.set((s) => ({ metadata: { ...s.metadata, [key]: next } }));
  const added = next.length - before.length;
  if (added) logAudit(me, 'Added event metadata', 'write', 'settings', key, { added });
  return { added, rejected, duplicates: ok.length - added };
}

export async function editMetadataOption(key: MetadataKey, index: number, value: string) {
  const me = currentUser();
  assertCan(me, 'manage:system');
  const v = metadataOptionSchema.parse(value);
  const list = [...db.get().metadata[key]];
  if (list.some((x, i) => i !== index && x.toLowerCase() === v.toLowerCase())) throw new Error('That option already exists.');
  const old = list[index];
  list[index] = v;
  db.set((s) => ({ metadata: { ...s.metadata, [key]: list } }));
  logAudit(me, 'Edited event metadata', 'write', 'settings', key, { option: `${old} → ${v}` });
}

export async function deleteMetadataOption(key: MetadataKey, index: number) {
  const me = currentUser();
  assertCan(me, 'manage:system');
  const list = [...db.get().metadata[key]];
  const [removed] = list.splice(index, 1);
  db.set((s) => ({ metadata: { ...s.metadata, [key]: list } }));
  logAudit(me, 'Deleted event metadata', 'write', 'settings', key, { option: removed });
}

/** Seed the on-device database on first launch. */
export async function ensureSeeded() {
  await whenHydrated();
  if (db.get().seeded) return;
  db.replace(await buildSeed(hashPassword));
}

/** Wipe local data and reload demo data (test build only). */
export async function resetDemoData() {
  const me = currentUser();
  assertCan(me, 'manage:system');
  db.replace(await buildSeed(hashPassword));
}
