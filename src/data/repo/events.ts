import { currentUser } from '@/auth/session';
import { db } from '@/data/db';
import { eventStepSchemas } from '@/domain/schemas';
import type { EventItem } from '@/domain/types';
import { slugify } from '@/lib/format';
import { newId } from '@/lib/ids';
import { assertCan } from '@/lib/rbac';
import { logAudit } from './audit';

export function isSlugTaken(slug: string, exceptId?: string) {
  return db.get().events.some((e) => e.slug === slug && e.id !== exceptId);
}

/** Unique slug: "title", then "title-2", "title-3"… */
export function uniqueSlug(base: string, exceptId?: string) {
  const root = slugify(base) || 'event';
  let slug = root;
  for (let i = 2; isSlugTaken(slug, exceptId); i++) slug = `${root}-${i}`;
  return slug;
}

/**
 * Create or update an event. Drafts may be saved with incomplete steps;
 * anything else must pass every step's validation.
 */
export async function saveEvent(event: EventItem): Promise<EventItem> {
  const me = currentUser();
  assertCan(me, 'write:events');
  const existing = db.get().events.find((e) => e.id === event.id);
  const slug = event.slug.trim() || uniqueSlug(event.title || 'untitled-event', event.id);
  if (isSlugTaken(slug, event.id)) throw new Error(`The URL slug "${slug}" is already used by another event.`);
  const toSave: EventItem = { ...event, slug, updatedAt: new Date().toISOString() };

  if (toSave.status !== 'draft') {
    for (const schema of Object.values(eventStepSchemas)) {
      const r = schema.safeParse(toSave);
      if (!r.success) throw new Error(r.error.issues[0]?.message ?? 'Event is incomplete. Save it as a draft instead.');
    }
  } else if (!toSave.title.trim()) {
    throw new Error('Give the draft a title first.');
  }

  db.set((s) => ({
    events: existing ? s.events.map((e) => (e.id === toSave.id ? toSave : e)) : [...s.events, toSave],
  }));
  logAudit(me, existing ? 'Updated event' : 'Created event', 'write', 'event', toSave.id, {
    title: toSave.title,
    status: existing && existing.status !== toSave.status ? `${existing.status} → ${toSave.status}` : toSave.status,
  });
  return toSave;
}

/** Duplicate copies everything except bookings; title "Copy of …", status Draft (spec §9 acceptance). */
export async function duplicateEvent(id: string): Promise<EventItem> {
  const me = currentUser();
  assertCan(me, 'write:events');
  const src = db.get().events.find((e) => e.id === id);
  if (!src) throw new Error('Event not found.');
  const now = new Date().toISOString();
  const copy: EventItem = {
    ...(JSON.parse(JSON.stringify(src)) as EventItem),
    id: newId(),
    title: `Copy of ${src.title}`,
    slug: uniqueSlug(`copy-of-${src.slug}`),
    status: 'draft',
    dates: src.dates.map((d) => ({ ...d, id: newId() })),
    createdAt: now,
    updatedAt: now,
  };
  db.set((s) => ({ events: [...s.events, copy] }));
  logAudit(me, 'Duplicated event', 'write', 'event', copy.id, { from: src.title });
  return copy;
}

export async function deleteEvent(id: string) {
  const me = currentUser();
  assertCan(me, 'delete:events');
  const ev = db.get().events.find((e) => e.id === id);
  if (!ev) return;
  const count = db.get().bookings.filter((b) => b.eventId === id).length;
  // TODO(spec): behaviour for deleting an event that has bookings is not specified; block it and suggest archiving.
  if (count > 0) throw new Error(`This event has ${count} booking(s). Archive or cancel it instead of deleting.`);
  db.set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
  logAudit(me, 'Deleted event', 'write', 'event', id, { title: ev.title });
}

export function logEventView(id: string) {
  const ev = db.get().events.find((e) => e.id === id);
  if (ev) logAudit(currentUser(), 'view event', 'read', 'event', id, { title: ev.title });
}
