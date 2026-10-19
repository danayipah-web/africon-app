import { router } from 'expo-router';
import { Download, Filter, Mail, MessageSquare, RefreshCw, Send, Tag, Upload, UserPlus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useCurrentUser } from '@/auth/session';
import { RadioGroup, SearchInput, Select, TextField } from '@/components/form';
import { FilterChips, ListRow, PageHeader, Pager, paginate, Screen } from '@/components/layout';
import { confirm, Sheet, toast, toastError } from '@/components/overlays';
import { Avatar, Button, Card, EmptyState, Pill, Row, StatCard, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import { addTags, addToList, createContact, syncExistingRecords } from '@/data/repo/crm';
import type { ConditionGroup, Contact } from '@/domain/types';
import { countConditions, FilterDrawer } from '@/features/crm/FilterBuilder';
import { CrmTabs, openCampaign } from '@/features/crm/shared';
import { useEvalContext } from '@/features/crm/useCrm';
import { toCsv } from '@/lib/csv';
import { compactMoney, money, relativeTime } from '@/lib/format';
import { can } from '@/lib/rbac';
import { emptyGroup, evaluate, segmentMembers } from '@/lib/segments/evaluate';
import { shareCsv, stamp } from '@/lib/share';
import { space, useTheme } from '@/theme';

type Chip = 'all' | 'customer' | 'lead' | 'review' | 'segment';

const ghs = (c: Contact) => c.totalSpent.filter((m) => m.currency === 'GHS').reduce((s, m) => s + m.amount, 0);

function exportContacts(list: Contact[]) {
  return shareCsv(
    `contacts-${stamp()}.csv`,
    toCsv(
      list.map((c) => ({
        name: c.fullName,
        email: c.email,
        phone: c.phone,
        company: c.company,
        jobTitle: c.jobTitle,
        country: c.country,
        city: c.city,
        stage: c.lifecycleStage,
        totalSpentGHS: ghs(c),
        paidBookings: c.paidBookingsCount,
        tags: c.tags,
        sources: c.sources,
        emailOptOut: c.emailOptOut,
        smsOptOut: c.smsOptOut,
        lastActivity: c.lastActivityAt,
        created: c.createdAt,
      })),
    ),
  );
}

export default function Contacts() {
  const { c } = useTheme();
  const me = useCurrentUser();
  const contacts = useDb((s) => s.contacts);
  const segments = useDb((s) => s.segments);
  const ctx = useEvalContext();
  const [q, setQ] = useState('');
  const [chip, setChip] = useState<Chip>('all');
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [rules, setRules] = useState<ConditionGroup>(emptyGroup());
  const [drawer, setDrawer] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagSheet, setTagSheet] = useState(false);
  const [tagText, setTagText] = useState('');
  const [listSheet, setListSheet] = useState(false);
  const [listMode, setListMode] = useState<'existing' | 'new'>('existing');
  const [listId, setListId] = useState('');
  const [listName, setListName] = useState('');
  const [newSheet, setNewSheet] = useState(false);
  const [nc, setNc] = useState({ fullName: '', email: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const canWrite = can(me, 'write:bookings');

  const kpi = useMemo(() => {
    const customers = contacts.filter((x) => x.lifecycleStage === 'customer').length;
    return {
      total: contacts.length,
      customers,
      leads: contacts.length - customers,
      conv: contacts.length ? Math.round((customers / contacts.length) * 100) : 0,
      revenue: contacts.reduce((s, x) => s + ghs(x), 0),
      review: contacts.filter((x) => x.needsReview).length,
    };
  }, [contacts]);

  const rows = useMemo(() => {
    let list = contacts;
    if (chip === 'customer') list = list.filter((x) => x.lifecycleStage === 'customer');
    if (chip === 'lead') list = list.filter((x) => x.lifecycleStage === 'lead');
    if (chip === 'review') list = list.filter((x) => x.needsReview);
    if (chip === 'segment' && segmentId) {
      const seg = segments.find((s) => s.id === segmentId);
      if (seg) {
        const ids = new Set(segmentMembers(seg, contacts, ctx).map((x) => x.id));
        list = list.filter((x) => ids.has(x.id));
      }
    }
    if (rules.children.length) list = list.filter((x) => evaluate(rules, x, ctx));
    const s = q.trim().toLowerCase();
    if (s) {
      const digits = s.replace(/\D/g, '');
      list = list.filter((x) => `${x.fullName} ${x.email} ${x.company}`.toLowerCase().includes(s) || (digits.length >= 3 && x.phone.replace(/\D/g, '').includes(digits)));
    }
    return [...list].sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''));
  }, [contacts, chip, segmentId, segments, rules, q, ctx]);

  const filtered = chip !== 'all' || rules.children.length > 0 || q.trim() !== '';
  const shown = paginate(rows, page, perPage);
  const sel = [...selected];

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const sync = async () => {
    setBusy(true);
    try {
      const r = await syncExistingRecords();
      toast(r.created ? `${r.created} new contact(s) from existing bookings` : 'Everything is already in the CRM');
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <PageHeader
        title="Contacts"
        description="Customers and leads from every booking, form, import and AI Sprint, deduplicated."
        actions={
          canWrite ? (
            <>
              <Button small title="Sync existing records" icon={RefreshCw} variant="secondary" loading={busy} onPress={sync} />
              <Button small title="Import" icon={Upload} variant="secondary" onPress={() => router.push('/crm/import')} />
              <Button small title="Add contact" icon={UserPlus} variant="secondary" onPress={() => setNewSheet(true)} />
              <Button small title="New campaign" icon={Send} onPress={() => openCampaign({})} />
            </>
          ) : null
        }
      />
      <CrmTabs />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {[
          ['Total', String(kpi.total)],
          ['Customers', String(kpi.customers)],
          ['Leads', String(kpi.leads)],
          ['Conversion', `${kpi.conv}%`],
          ['Revenue', compactMoney(kpi.revenue)],
          ['Needs review', String(kpi.review)],
        ].map(([k, v]) => (
          <StatCard key={k} label={k!} value={v!} style={{ width: '31.5%', padding: 10 }} />
        ))}
      </View>
      <Card>
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name, email, phone, company" />
        <FilterChips
          value={chip}
          onChange={(v) => {
            setChip(v);
            setPage(1);
          }}
          chips={[
            { value: 'all', label: 'All', count: kpi.total },
            { value: 'customer', label: 'Customers', count: kpi.customers },
            { value: 'lead', label: 'Leads', count: kpi.leads },
            { value: 'review', label: 'Needs review', count: kpi.review },
            { value: 'segment', label: 'Segments' },
          ]}
        />
        {chip === 'segment' ? (
          <View style={{ marginTop: 8 }}>
            <Select value={segmentId ?? ''} onChange={(v) => { setSegmentId(v); setPage(1); }} placeholder="Pick a segment" options={segments.map((s) => ({ value: s.id, label: s.name, sub: s.type === 'fixed' ? 'Fixed list' : 'Rules' }))} />
          </View>
        ) : null}
        <Row style={{ marginTop: 10 }}>
          <Button small variant="secondary" icon={Filter} title={`Filters${countConditions(rules) ? ` (${countConditions(rules)})` : ''}`} onPress={() => setDrawer(true)} />
          {rules.children.length ? <Button small variant="ghost" title="Clear filters" onPress={() => setRules(emptyGroup())} /> : null}
        </Row>
        <Txt v="faint" style={{ marginTop: 6 }}>
          Filter by events, AI Sprints, surveys, sources, tags, spend, dates, consent and more.
        </Txt>
      </Card>

      <Row style={{ justifyContent: 'space-between' }} wrap>
        <Txt v="h3">{filtered ? `${rows.length} contacts match` : `${rows.length} contacts`}</Txt>
        {canWrite && rows.length ? (
          <Button
            small
            variant="ghost"
            icon={Send}
            title={filtered ? `Send campaign to these ${rows.length}` : `Send campaign to all ${rows.length}`}
            onPress={() =>
              openCampaign(
                rules.children.length && chip === 'all' && !q.trim()
                  ? { conditions: rules }
                  : chip === 'segment' && segmentId && !rules.children.length && !q.trim()
                    ? { segmentIds: [segmentId] }
                    : filtered
                      ? { contactIds: rows.map((x) => x.id) }
                      : {},
              )
            }
          />
        ) : null}
      </Row>

      {selected.size ? (
        <Card style={{ backgroundColor: c.primarySoft, borderColor: c.primary }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt v="label">{selected.size} selected</Txt>
            <Button small variant="ghost" title="Clear selection" onPress={() => setSelected(new Set())} />
          </Row>
          <Row wrap gap={6} style={{ marginTop: 6 }}>
            {canWrite ? <Button small variant="secondary" icon={Mail} title="Email" onPress={() => openCampaign({ channel: 'email', contactIds: sel })} /> : null}
            {canWrite ? <Button small variant="secondary" icon={MessageSquare} title="SMS" onPress={() => openCampaign({ channel: 'sms', contactIds: sel })} /> : null}
            {canWrite ? <Button small variant="secondary" icon={Tag} title="Tags" onPress={() => setTagSheet(true)} /> : null}
            {canWrite ? <Button small variant="secondary" title="Add to list" onPress={() => setListSheet(true)} /> : null}
            <Button small variant="secondary" icon={Download} title="Export CSV" onPress={() => exportContacts(contacts.filter((x) => selected.has(x.id))).catch(toastError)} />
          </Row>
        </Card>
      ) : null}

      {rows.length === 0 ? <EmptyState title="No contacts match" body="Clear the filters or search for a different name." /> : null}
      <View style={{ gap: 8 }}>
        {shown.map((x) => {
          const on = selected.has(x.id);
          return (
            <ListRow key={x.id} selected={on} onPress={() => router.push(`/crm/${x.id}`)}>
              <Row>
                <Pressable onPress={() => toggle(x.id)} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`Select ${x.fullName}`}>
                  <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: on ? c.primary : c.textFaint, backgroundColor: on ? c.primary : 'transparent' }} />
                </Pressable>
                <Avatar name={x.fullName || x.email} />
                <View style={{ flex: 1 }}>
                  <Row gap={6}>
                    <Txt v="label" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {x.fullName || '(no name)'}
                    </Txt>
                    {x.needsReview ? <Pill label="Needs review" tone="amber" /> : null}
                  </Row>
                  <Txt v="faint" numberOfLines={1}>
                    {x.email || 'No email'} · {x.phone || 'No phone'}
                  </Txt>
                </View>
              </Row>
              <Row wrap gap={8}>
                <Pill label={x.lifecycleStage === 'customer' ? 'Customer' : 'Lead'} tone={x.lifecycleStage === 'customer' ? 'green' : 'blue'} />
                <Txt v="small" style={{ fontWeight: '600' }}>
                  {money(ghs(x), 'GHS')}
                </Txt>
                <Txt v="faint">{relativeTime(x.lastActivityAt)}</Txt>
              </Row>
            </ListRow>
          );
        })}
      </View>
      <Pager page={page} perPage={perPage} total={rows.length} onPage={setPage} onPerPage={(n) => { setPerPage(n); setPage(1); }} perPageOptions={[25, 50, 100]} showGoTo />

      <FilterDrawer open={drawer} onClose={() => setDrawer(false)} value={rules} onApply={(g) => { setRules(g); setPage(1); }} contacts={contacts} ctx={ctx} />

      <Sheet
        open={tagSheet}
        onClose={() => setTagSheet(false)}
        title={`Tag ${selected.size} contact(s)`}
        footer={
          <Button
            title="Add tags"
            disabled={!tagText.trim()}
            onPress={async () => {
              try {
                await addTags(sel, tagText.split(','));
                toast('Tags added');
                setTagSheet(false);
                setTagText('');
              } catch (e) {
                toastError(e);
              }
            }}
          />
        }>
        <TextField label="Tags" value={tagText} onChange={setTagText} helper="Separate several with commas" autoCapitalize="none" />
      </Sheet>

      <Sheet
        open={listSheet}
        onClose={() => setListSheet(false)}
        title={`Add ${selected.size} to a list`}
        footer={
          <Button
            title="Add to list"
            disabled={listMode === 'existing' ? !listId : !listName.trim()}
            onPress={async () => {
              try {
                await addToList(sel, listMode === 'existing' ? { segmentId: listId } : { newName: listName });
                toast('Added to list');
                setListSheet(false);
                setListName('');
              } catch (e) {
                toastError(e);
              }
            }}
          />
        }>
        <RadioGroup
          value={listMode}
          onChange={setListMode}
          options={[
            { value: 'existing', label: 'An existing fixed list' },
            { value: 'new', label: 'A new fixed list' },
          ]}
        />
        {listMode === 'existing' ? (
          <Select value={listId} onChange={setListId} placeholder="Choose a list" options={segments.filter((s) => s.type === 'fixed').map((s) => ({ value: s.id, label: s.name, sub: `${s.contactIds.length} contacts` }))} />
        ) : (
          <TextField label="List name" value={listName} onChange={setListName} />
        )}
      </Sheet>

      <Sheet
        open={newSheet}
        onClose={() => setNewSheet(false)}
        title="Add contact"
        footer={
          <Button
            title="Add contact"
            onPress={async () => {
              try {
                if (!nc.email.trim() && !nc.phone.trim()) throw new Error('A contact needs an email or a phone number.');
                const dup = contacts.find((x) => nc.email && x.email.toLowerCase() === nc.email.trim().toLowerCase());
                if (dup && !(await confirm({ title: 'Possible duplicate', message: `${dup.fullName || dup.email} already uses this email. Add anyway?`, confirmLabel: 'Add anyway' }))) return;
                const created = await createContact({ fullName: nc.fullName.trim(), email: nc.email.trim(), phone: nc.phone.trim(), needsReview: !!dup });
                setNewSheet(false);
                setNc({ fullName: '', email: '', phone: '' });
                router.push(`/crm/${created.id}`);
              } catch (e) {
                toastError(e);
              }
            }}
          />
        }>
        <TextField label="Full name" value={nc.fullName} onChange={(v) => setNc((x) => ({ ...x, fullName: v }))} />
        <TextField label="Email" value={nc.email} onChange={(v) => setNc((x) => ({ ...x, email: v }))} keyboardType="email-address" />
        <TextField label="Phone" value={nc.phone} onChange={(v) => setNc((x) => ({ ...x, phone: v }))} keyboardType="phone-pad" />
      </Sheet>
    </Screen>
  );
}
