import { currentUser } from '@/auth/session';
import { db } from '@/data/db';
import { contactEditSchema } from '@/domain/schemas';
import type { Campaign, Contact, ContactActivity, PaymentAdvice, Segment } from '@/domain/types';
import { renderMergeTags, resolveAudience } from '@/lib/campaign';
import { act, blankContact, findContact, mergeContacts, normEmail, normPhone, syncBooking } from '@/lib/crmSync';
import { newId } from '@/lib/ids';
import { assertCan } from '@/lib/rbac';
import { buildContext, emptyGroup } from '@/lib/segments/evaluate';
import { logAudit } from './audit';

// TODO(spec): the role table has no CRM permissions; CRM writes use write:bookings
// (Admin + Content Manager), reads are open to every role.
const CRM_WRITE = 'write:bookings' as const;

const nowIso = () => new Date().toISOString();

export function evalContext() {
  const s = db.get();
  return buildContext(s.bookings, s.activities, s.segments);
}

export async function createContact(patch: Partial<Contact>) {
  const me = currentUser();
  assertCan(me, CRM_WRITE);
  const now = nowIso();
  const c = blankContact(now, { sources: ['Office'], firstSource: 'Office', ...patch });
  db.set((s) => ({ contacts: [c, ...s.contacts], activities: [...s.activities, act(c.id, 'created', 'Office', 'Contact created by the office', now)] }));
  logAudit(me, 'Created contact', 'write', 'contact', c.id, { name: c.fullName });
  return c;
}

export async function updateContact(id: string, patch: Partial<Contact>) {
  const me = currentUser();
  assertCan(me, CRM_WRITE);
  const prev = db.get().contacts.find((c) => c.id === id);
  if (!prev) throw new Error('Contact not found.');
  const merged = { ...prev, ...patch };
  contactEditSchema.parse({ fullName: merged.fullName, email: merged.email, phone: merged.phone });
  if (!merged.email && !merged.phone) throw new Error('A contact needs an email or a phone number.');
  const next: Contact = { ...merged, phone: merged.phone ? normPhone(merged.phone) : '', updatedAt: nowIso() };
  db.set((s) => ({ contacts: s.contacts.map((c) => (c.id === id ? next : c)) }));
  const changed = Object.keys(patch).filter((k) => JSON.stringify((prev as never)[k]) !== JSON.stringify((patch as never)[k]));
  logAudit(me, 'Updated contact', 'write', 'contact', id, { name: next.fullName, changed });
}

export async function deleteContact(id: string) {
  const me = currentUser();
  assertCan(me, CRM_WRITE);
  const prev = db.get().contacts.find((c) => c.id === id);
  if (!prev) return;
  db.set((s) => ({
    contacts: s.contacts.filter((c) => c.id !== id),
    activities: s.activities.filter((a) => a.contactId !== id),
    segments: s.segments.map((g) => (g.type === 'fixed' ? { ...g, contactIds: g.contactIds.filter((x) => x !== id) } : g)),
  }));
  logAudit(me, 'Deleted contact', 'write', 'contact', id, { name: prev.fullName, email: prev.email });
}

export async function addTags(ids: string[], tags: string[]) {
  const me = currentUser();
  assertCan(me, CRM_WRITE);
  const clean = tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!clean.length) return;
  const set = new Set(ids);
  db.set((s) => ({
    contacts: s.contacts.map((c) => (set.has(c.id) ? { ...c, tags: Array.from(new Set([...c.tags, ...clean])), updatedAt: nowIso() } : c)),
  }));
  logAudit(me, 'Tagged contacts', 'write', 'contact', '', { count: ids.length, tags: clean });
}

export async function removeTag(id: string, tag: string) {
  const me = currentUser();
  assertCan(me, CRM_WRITE);
  db.set((s) => ({ contacts: s.contacts.map((c) => (c.id === id ? { ...c, tags: c.tags.filter((t) => t !== tag) } : c)) }));
  logAudit(me, 'Removed tag', 'write', 'contact', id, { tag });
}

/** Bulk "Add to list": append to a fixed segment, or create one. */
export async function addToList(ids: string[], target: { segmentId?: string; newName?: string }) {
  const me = currentUser();
  assertCan(me, CRM_WRITE);
  if (target.segmentId) {
    db.set((s) => ({
      segments: s.segments.map((g) =>
        g.id === target.segmentId ? { ...g, contactIds: Array.from(new Set([...g.contactIds, ...ids])), updatedAt: nowIso() } : g,
      ),
    }));
    logAudit(me, 'Added to list', 'write', 'segment', target.segmentId, { count: ids.length });
    return target.segmentId;
  }
  const name = target.newName?.trim();
  if (!name) throw new Error('Name the new list.');
  const seg: Segment = { id: newId(), name, description: '', type: 'fixed', rules: emptyGroup(), contactIds: [...ids], updatedAt: nowIso() };
  db.set((s) => ({ segments: [...s.segments, seg] }));
  logAudit(me, 'Created list', 'write', 'segment', seg.id, { name, count: ids.length });
  return seg.id;
}

export async function mergeDuplicate(primaryId: string, duplicateId: string) {
  const me = currentUser();
  assertCan(me, CRM_WRITE);
  if (primaryId === duplicateId) throw new Error('Pick a different contact to merge.');
  const s = db.get();
  const primary = s.contacts.find((c) => c.id === primaryId);
  const dup = s.contacts.find((c) => c.id === duplicateId);
  if (!primary || !dup) throw new Error('Contact not found.');
  const res = mergeContacts(primary, dup, s.activities, nowIso());
  db.set((st) => ({
    contacts: st.contacts.filter((c) => c.id !== duplicateId).map((c) => (c.id === primaryId ? res.contact : c)),
    activities: res.activities,
    segments: st.segments.map((g) =>
      g.type === 'fixed' && g.contactIds.includes(duplicateId)
        ? { ...g, contactIds: Array.from(new Set(g.contactIds.map((x) => (x === duplicateId ? primaryId : x)))) }
        : g,
    ),
  }));
  logAudit(me, 'Merged contacts', 'write', 'contact', primaryId, { kept: primary.fullName, merged: dup.fullName || dup.email });
}

export async function addPaymentAdvice(contactId: string, input: Omit<PaymentAdvice, 'id' | 'contactId' | 'status' | 'approvedBy' | 'at'>) {
  const me = currentUser();
  assertCan(me, CRM_WRITE);
  if (!(input.amount > 0)) throw new Error('Enter the amount paid.');
  const pa: PaymentAdvice = { ...input, id: newId(), contactId, status: 'pending', approvedBy: null, at: nowIso() };
  db.set((s) => ({
    paymentAdvice: [pa, ...s.paymentAdvice],
    activities: [...s.activities, act(contactId, 'payment_advice', 'Office', `Payment advice uploaded: GHS ${input.amount.toFixed(2)}`, pa.at)],
  }));
  logAudit(me, 'Uploaded payment advice', 'write', 'contact', contactId, { amount: input.amount, method: input.method });
}

/** Approving payment advice records an offline payment and converts a lead into a customer (spec §6.3). */
export async function reviewPaymentAdvice(id: string, decision: 'approved' | 'rejected') {
  const me = currentUser();
  assertCan(me, CRM_WRITE);
  const s = db.get();
  const pa = s.paymentAdvice.find((p) => p.id === id);
  if (!pa || pa.status !== 'pending') return;
  const now = nowIso();
  const acts: ContactActivity[] = [];
  db.set((st) => ({
    paymentAdvice: st.paymentAdvice.map((p) => (p.id === id ? { ...p, status: decision, approvedBy: me?.email ?? null } : p)),
    contacts:
      decision === 'approved'
        ? st.contacts.map((c) => {
            if (c.id !== pa.contactId) return c;
            const ghs = c.totalSpent.find((m) => m.currency === 'GHS');
            const totalSpent = ghs
              ? c.totalSpent.map((m) => (m.currency === 'GHS' ? { ...m, amount: m.amount + pa.amount } : m))
              : [...c.totalSpent, { amount: pa.amount, currency: 'GHS' as const }];
            if (c.lifecycleStage !== 'customer') acts.push(act(c.id, 'lifecycle', 'Office', 'Became a customer: payment advice approved', now));
            acts.push({ ...act(c.id, 'payment', 'Office', `Offline payment approved (${pa.method})`, now), amount: { amount: pa.amount, currency: 'GHS' } });
            return {
              ...c,
              lifecycleStage: 'customer' as const,
              totalSpent,
              paidBookingsCount: c.paidBookingsCount + 1,
              customerSince: c.customerSince ?? now,
              lastPaidBookingAt: now,
              lastActivityAt: now,
              updatedAt: now,
            };
          })
        : st.contacts,
  }));
  if (acts.length) db.set((st) => ({ activities: [...st.activities, ...acts] }));
  logAudit(me, decision === 'approved' ? 'Approved payment advice' : 'Rejected payment advice', 'write', 'contact', pa.contactId, {
    amount: pa.amount,
  });
}

export async function saveSegment(seg: Segment) {
  const me = currentUser();
  assertCan(me, CRM_WRITE);
  if (!seg.name.trim()) throw new Error('Give the segment a name.');
  const exists = db.get().segments.some((s) => s.id === seg.id);
  const next = { ...seg, name: seg.name.trim(), updatedAt: nowIso() };
  db.set((s) => ({ segments: exists ? s.segments.map((x) => (x.id === seg.id ? next : x)) : [...s.segments, next] }));
  logAudit(me, exists ? 'Updated segment' : 'Created segment', 'write', 'segment', seg.id, { name: next.name, type: next.type });
  return next;
}

export async function deleteSegment(id: string) {
  const me = currentUser();
  assertCan(me, CRM_WRITE);
  const seg = db.get().segments.find((s) => s.id === id);
  db.set((s) => ({ segments: s.segments.filter((x) => x.id !== id) }));
  logAudit(me, 'Deleted segment', 'write', 'segment', id, { name: seg?.name });
}

export type CampaignDraft = Omit<Campaign, 'id' | 'status' | 'recipients' | 'sent' | 'failed' | 'sentAt' | 'createdAt'>;

/**
 * Send or schedule a campaign. Delivery is simulated in the test build
 * (no mNotify/email provider); every send is still recorded per contact.
 */
export async function sendCampaign(draft: CampaignDraft, removedIds: string[] = []) {
  const me = currentUser();
  assertCan(me, CRM_WRITE);
  if (!draft.name.trim()) throw new Error('Name the campaign.');
  if (draft.channel === 'email' && !draft.subject.trim()) throw new Error('Add a subject.');
  if (!draft.body.trim()) throw new Error('Write the message.');
  const s = db.get();
  const audience = resolveAudience(s.contacts, evalContext(), draft.audience, draft.channel, new Set(removedIds));
  if (!audience.recipients.length) throw new Error('Nobody in this audience can receive it.');
  const now = nowIso();
  const campaign: Campaign = {
    ...draft,
    id: newId(),
    status: draft.scheduledAt && draft.scheduledAt > now ? 'scheduled' : 'completed',
    recipients: audience.recipients.length,
    sent: 0,
    failed: 0,
    sentAt: null,
    createdAt: now,
    audience: { ...draft.audience, contactIds: draft.audience.contactIds.length ? draft.audience.contactIds : [] },
  };
  if (campaign.status === 'scheduled') {
    // Freeze the recipient list at scheduling time.
    campaign.audience = { ...campaign.audience, contactIds: audience.recipients.map((c) => c.id) };
    db.set((st) => ({ campaigns: [campaign, ...st.campaigns] }));
    logAudit(me, 'Scheduled campaign', 'write', 'campaign', campaign.id, { name: campaign.name, recipients: campaign.recipients, when: draft.scheduledAt });
    return campaign;
  }
  deliver(campaign, audience.recipients);
  logAudit(me, 'Sent campaign', 'write', 'campaign', campaign.id, { name: campaign.name, channel: campaign.channel, recipients: campaign.recipients });
  return campaign;
}

function deliver(campaign: Campaign, recipients: Contact[]) {
  const now = nowIso();
  const ids = new Set(recipients.map((c) => c.id));
  const acts: ContactActivity[] = recipients.map((c) => ({
    ...act(
      c.id,
      campaign.channel,
      `campaign:${campaign.id}`,
      campaign.channel === 'email' ? `Email: ${renderMergeTags(campaign.subject, c)}` : `SMS: ${campaign.name}`,
      now,
    ),
  }));
  const done: Campaign = { ...campaign, status: 'completed', sent: recipients.length, failed: 0, sentAt: now };
  db.set((st) => ({
    campaigns: st.campaigns.some((c) => c.id === done.id) ? st.campaigns.map((c) => (c.id === done.id ? done : c)) : [done, ...st.campaigns],
    contacts: st.contacts.map((c) =>
      ids.has(c.id)
        ? campaign.channel === 'email'
          ? { ...c, emailsSent: c.emailsSent + 1, lastEmailAt: now, lastActivityAt: now }
          : { ...c, smsSent: c.smsSent + 1, lastSmsAt: now, lastActivityAt: now }
        : c,
    ),
    activities: [...st.activities, ...acts],
  }));
}

/** Runs scheduled campaigns whose time has come (called on app start/foreground). */
export function processDueCampaigns() {
  const s = db.get();
  const now = nowIso();
  for (const c of s.campaigns.filter((x) => x.status === 'scheduled' && x.scheduledAt && x.scheduledAt <= now)) {
    const ids = new Set(c.audience.contactIds);
    deliver(c, s.contacts.filter((x) => ids.has(x.id)));
    logAudit(null, 'Sent scheduled campaign', 'write', 'campaign', c.id, { name: c.name });
  }
}

export async function cancelScheduledCampaign(id: string) {
  const me = currentUser();
  assertCan(me, CRM_WRITE);
  db.set((s) => ({ campaigns: s.campaigns.map((c) => (c.id === id && c.status === 'scheduled' ? { ...c, status: 'draft' } : c)) }));
  logAudit(me, 'Cancelled scheduled campaign', 'write', 'campaign', id);
}

/** Backfill contacts from every booking ("Sync existing records"). */
export async function syncExistingRecords() {
  const me = currentUser();
  assertCan(me, CRM_WRITE);
  const s = db.get();
  let contacts = s.contacts;
  const activities: ContactActivity[] = [];
  let created = 0;
  const byEmail = new Map<string, typeof s.bookings>();
  for (const b of s.bookings) {
    const k = normEmail(b.customer.email);
    byEmail.set(k, [...(byEmail.get(k) ?? []), b]);
  }
  for (const [, list] of byEmail) {
    const latest = list[list.length - 1]!;
    const before = findContact(contacts, latest.customer.email, latest.customer.phone);
    const res = syncBooking(contacts, latest, s.events.find((e) => e.id === latest.eventId), list, nowIso());
    if (!before) {
      created++;
      contacts = [...contacts, res.contact];
      activities.push(...res.activities.filter((a) => a.type !== 'booking'));
    } else {
      // keep existing activity history; only refresh derived revenue fields
      contacts = contacts.map((c) => (c.id === res.contact.id ? { ...res.contact, lastActivityAt: c.lastActivityAt } : c));
    }
  }
  db.set((st) => ({ contacts, activities: [...st.activities, ...activities] }));
  logAudit(me, 'Synced existing records', 'write', 'contact', '', { created, bookings: s.bookings.length });
  return { created };
}

export interface ImportRow {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  country?: string;
  city?: string;
  tags?: string;
  notes?: string;
}

export interface ImportPlan {
  create: Contact[];
  update: Contact[];
  skipped: { row: number; reason: string }[];
}

/** Dry-run an import: duplicates merge on email, then normalised phone (spec §6.6). */
export function planImport(rows: ImportRow[]): ImportPlan {
  const now = nowIso();
  const existing = db.get().contacts;
  const working = [...existing];
  const plan: ImportPlan = { create: [], update: [], skipped: [] };
  rows.forEach((r, i) => {
    const email = (r.email ?? '').trim();
    const phone = (r.phone ?? '').trim();
    if (!email && !phone) return plan.skipped.push({ row: i + 2, reason: 'No email or phone' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return plan.skipped.push({ row: i + 2, reason: `Invalid email "${email}"` });
    const name = (r.fullName ?? '').trim() || [r.firstName, r.lastName].filter(Boolean).join(' ').trim();
    const tags = (r.tags ?? '').split(/[;,]/).map((t) => t.trim().toLowerCase()).filter(Boolean);
    const match = findContact(working, email, phone);
    if (match) {
      const upd: Contact = {
        ...match,
        fullName: match.fullName || name,
        email: match.email || email,
        phone: match.phone || (phone ? normPhone(phone) : ''),
        company: r.company?.trim() || match.company,
        jobTitle: r.jobTitle?.trim() || match.jobTitle,
        country: r.country?.trim() || match.country,
        city: r.city?.trim() || match.city,
        tags: Array.from(new Set([...match.tags, ...tags])),
        notes: [match.notes, r.notes?.trim()].filter(Boolean).join('\n'),
        sources: match.sources.includes('Import') ? match.sources : [...match.sources, 'Import'],
        updatedAt: now,
      };
      const idx = working.findIndex((c) => c.id === match.id);
      working[idx] = upd;
      const already = plan.create.findIndex((c) => c.id === match.id);
      if (already >= 0) plan.create[already] = upd;
      else {
        const u = plan.update.findIndex((c) => c.id === match.id);
        if (u >= 0) plan.update[u] = upd;
        else plan.update.push(upd);
      }
    } else {
      const c = blankContact(now, {
        fullName: name,
        email,
        phone: phone ? normPhone(phone) : '',
        company: r.company?.trim() ?? '',
        jobTitle: r.jobTitle?.trim() ?? '',
        country: r.country?.trim() ?? '',
        city: r.city?.trim() ?? '',
        tags,
        notes: r.notes?.trim() ?? '',
        sources: ['Import'],
        firstSource: 'Import',
      });
      working.push(c);
      plan.create.push(c);
    }
  });
  return plan;
}

export async function commitImport(plan: ImportPlan, fileName: string) {
  const me = currentUser();
  assertCan(me, CRM_WRITE);
  const now = nowIso();
  const upd = new Map(plan.update.map((c) => [c.id, c]));
  db.set((s) => ({
    contacts: [...s.contacts.map((c) => upd.get(c.id) ?? c), ...plan.create],
    activities: [
      ...s.activities,
      ...plan.create.map((c) => act(c.id, 'import', 'Import', `Contact created via import (${fileName})`, now)),
      ...plan.update.map((c) => act(c.id, 'import', 'Import', `Updated by import (${fileName})`, now)),
    ],
  }));
  logAudit(me, 'Imported contacts', 'write', 'contact', '', {
    file: fileName,
    created: plan.create.length,
    updated: plan.update.length,
    skipped: plan.skipped.length,
  });
}
