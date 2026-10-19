import type { Campaign, Contact } from '@/domain/types';
import { normEmail, normPhone } from '@/lib/crmSync';
import { canReceiveEmail, evaluate, isGhanaMobile, segmentMembers, type EvalContext } from '@/lib/segments/evaluate';

export const CRM_MERGE_TAGS = ['firstName', 'lastName', 'fullName', 'company'] as const;

export function renderMergeTags(text: string, c: Pick<Contact, 'fullName' | 'company'>) {
  const parts = c.fullName.trim().split(/\s+/);
  const vals: Record<string, string> = {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
    fullName: c.fullName,
    company: c.company,
  };
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in vals ? vals[k]! : m));
}

/** SMS is billed per 160-character segment (spec §6.5). */
export function smsSegments(text: string) {
  if (!text) return 0;
  return Math.ceil(text.length / 160);
}

export interface AudienceResult {
  /** Final, deduplicated list that will receive the message. */
  recipients: Contact[];
  inAudience: number;
  missingAddress: number;
  optedOut: number;
  invalidNumber: number;
  duplicates: number;
}

/**
 * Resolve who receives a campaign (spec §6.5 rules): a hand-picked selection
 * wins over filters; otherwise segments (none = everyone) ∩ conditions − excluded
 * segments. Opted-out contacts are dropped unless includeOptedOut; SMS goes to
 * valid Ghana numbers only; recipients are deduplicated by address.
 */
export function resolveAudience(
  contacts: Contact[],
  ctx: EvalContext,
  audience: Campaign['audience'],
  channel: Campaign['channel'],
  removedIds: Set<string> = new Set(),
): AudienceResult {
  let pool: Contact[];
  if (audience.contactIds.length) {
    const ids = new Set(audience.contactIds);
    pool = contacts.filter((c) => ids.has(c.id));
  } else {
    if (audience.segmentIds.length) {
      const ids = new Set<string>();
      for (const sid of audience.segmentIds) {
        const seg = ctx.segments.find((s) => s.id === sid);
        if (seg) segmentMembers(seg, contacts, ctx).forEach((c) => ids.add(c.id));
      }
      pool = contacts.filter((c) => ids.has(c.id));
    } else {
      pool = contacts;
    }
    if (audience.conditions) pool = pool.filter((c) => evaluate(audience.conditions!, c, ctx));
    if (audience.excludeSegmentIds.length) {
      const excluded = new Set<string>();
      for (const sid of audience.excludeSegmentIds) {
        const seg = ctx.segments.find((s) => s.id === sid);
        if (seg) segmentMembers(seg, contacts, ctx).forEach((c) => excluded.add(c.id));
      }
      pool = pool.filter((c) => !excluded.has(c.id));
    }
  }
  pool = pool.filter((c) => !removedIds.has(c.id));

  let missingAddress = 0;
  let optedOut = 0;
  let invalidNumber = 0;
  let duplicates = 0;
  const seen = new Set<string>();
  const recipients: Contact[] = [];
  for (const c of pool) {
    if (channel === 'email') {
      if (!c.email) {
        missingAddress++;
        continue;
      }
      if (c.emailOptOut && !audience.includeOptedOut) {
        optedOut++;
        continue;
      }
    } else {
      if (!c.phone) {
        missingAddress++;
        continue;
      }
      if (!isGhanaMobile(c.phone)) {
        invalidNumber++;
        continue;
      }
      if (c.smsOptOut && !audience.includeOptedOut) {
        optedOut++;
        continue;
      }
    }
    const key = channel === 'email' ? normEmail(c.email) : normPhone(c.phone);
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    recipients.push(c);
  }
  return { recipients, inAudience: pool.length, missingAddress, optedOut, invalidNumber, duplicates };
}

export { canReceiveEmail };
