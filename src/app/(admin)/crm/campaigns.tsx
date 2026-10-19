import { Filter, RefreshCw, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import { useCurrentUser } from '@/auth/session';
import { Checkbox, DateField, MultiSelect, RadioGroup, TextField } from '@/components/form';
import { ListRow, PageHeader, Screen, Tabs } from '@/components/layout';
import { confirm, Sheet, toast, toastError } from '@/components/overlays';
import { Button, Card, EmptyState, IconButton, Row, SectionTitle, SimNote, StatusPill, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import { cancelScheduledCampaign, sendCampaign } from '@/data/repo/crm';
import type { Campaign, ConditionGroup } from '@/domain/types';
import { countConditions, FilterDrawer } from '@/features/crm/FilterBuilder';
import { CrmTabs, useCampaignPrefill } from '@/features/crm/shared';
import { useEvalContext } from '@/features/crm/useCrm';
import { CRM_MERGE_TAGS, renderMergeTags, resolveAudience, smsSegments } from '@/lib/campaign';
import { dateTime } from '@/lib/format';
import { can } from '@/lib/rbac';
import { emptyGroup } from '@/lib/segments/evaluate';
import { radius, space, useTheme } from '@/theme';

type Step = 0 | 1 | 2;

export default function Campaigns() {
  const { c, tones } = useTheme();
  const me = useCurrentUser();
  const contacts = useDb((s) => s.contacts);
  const segments = useDb((s) => s.segments);
  const campaigns = useDb((s) => s.campaigns);
  const ctx = useEvalContext();
  const takePrefill = useCampaignPrefill((s) => s.prefill);

  const [step, setStep] = useState<Step>(0);
  const [channel, setChannel] = useState<Campaign['channel']>('email');
  const [selection, setSelection] = useState<string[]>([]);
  const [segmentIds, setSegmentIds] = useState<string[]>([]);
  const [excludeIds, setExcludeIds] = useState<string[]>([]);
  const [rules, setRules] = useState<ConditionGroup>(emptyGroup());
  const [includeOptedOut, setIncludeOptedOut] = useState(false);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState(false);
  const [recipientsOpen, setRecipientsOpen] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [fromName, setFromName] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [body, setBody] = useState('');
  const [testTo, setTestTo] = useState(me?.email ?? '');
  const [preview, setPreview] = useState<'rendered' | 'plain'>('rendered');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('mobile');
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [busy, setBusy] = useState(false);

  // Carry over a selection / filter handed from the Contacts list or a contact page.
  const [appliedPrefill, setAppliedPrefill] = useState<typeof takePrefill>(null);
  if (takePrefill && takePrefill !== appliedPrefill) {
    setAppliedPrefill(takePrefill);
    if (takePrefill.channel) setChannel(takePrefill.channel);
    setSelection(takePrefill.contactIds ?? []);
    setSegmentIds(takePrefill.segmentIds ?? []);
    setRules(takePrefill.conditions ?? emptyGroup());
    setRemoved(new Set());
    setStep(0);
  }

  const audience: Campaign['audience'] = useMemo(
    () => ({ segmentIds, conditions: rules.children.length ? rules : null, excludeSegmentIds: excludeIds, contactIds: selection, includeOptedOut }),
    [segmentIds, rules, excludeIds, selection, includeOptedOut],
  );
  const result = useMemo(() => resolveAudience(contacts, ctx, audience, channel, removed), [contacts, ctx, audience, channel, removed]);
  const audienceLabel = selection.length
    ? `${selection.length} hand-picked contacts`
    : segmentIds.length
      ? segmentIds.map((id) => segments.find((s) => s.id === id)?.name).filter(Boolean).join(', ')
      : rules.children.length
        ? `Everyone matching ${countConditions(rules)} condition(s)`
        : 'All contacts';

  const sample = result.recipients[0] ?? { fullName: 'Ama Mensah', company: 'Africon' };
  const canWrite = can(me, 'write:bookings');

  const insert = (target: 'subject' | 'body', tag: string) => (target === 'subject' ? setSubject((s) => `${s}{{${tag}}}`) : setBody((s) => `${s}{{${tag}}}`));

  const reset = () => {
    setStep(0);
    setSelection([]);
    setSegmentIds([]);
    setExcludeIds([]);
    setRules(emptyGroup());
    setIncludeOptedOut(false);
    setRemoved(new Set());
    setName('');
    setSubject('');
    setBody('');
    setWhen('now');
    setScheduledAt('');
  };

  const canContinue = step === 0 ? result.recipients.length > 0 : step === 1 ? !!name.trim() && !!body.trim() && (channel === 'sms' || !!subject.trim()) : true;

  const send = async () => {
    if (when === 'later' && (!scheduledAt || scheduledAt <= new Date().toISOString())) return toast('Pick a time in the future', 'error');
    const ok = await confirm({
      title: when === 'now' ? 'Send campaign?' : 'Schedule campaign?',
      message: `${channel === 'email' ? 'Email' : 'SMS'} "${name}" to ${result.recipients.length} recipient(s)${when === 'later' ? ` at ${dateTime(scheduledAt)}` : ' now'}.`,
      confirmLabel: when === 'now' ? `Send to ${result.recipients.length}` : 'Schedule',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const camp = await sendCampaign(
        { name, channel, audience, audienceLabel, subject, fromName: fromName || 'Africon', replyTo, body, scheduledAt: when === 'later' ? scheduledAt : null },
        [...removed],
      );
      toast(camp.status === 'scheduled' ? 'Campaign scheduled' : `Sent to ${camp.sent} (simulated)`);
      reset();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const chips = (target: 'subject' | 'body') => (
    <Row wrap gap={6} style={{ marginTop: -6, marginBottom: space.md }}>
      {CRM_MERGE_TAGS.map((t) => (
        <Button key={t} small variant="secondary" title={`{{${t}}}`} onPress={() => insert(target, t)} />
      ))}
    </Row>
  );

  return (
    <Screen>
      <PageHeader title="Campaigns" description="Compose and send email or SMS broadcasts to a CRM segment" />
      <CrmTabs />
      {!canWrite ? <SimNote text="Your role can view campaigns but not send them." /> : null}

      <Card>
        <SectionTitle title="Summary" />
        <Txt v="small">Channel: {channel === 'email' ? 'Email' : 'SMS'}</Txt>
        <Txt v="small">Name: {name || '—'}</Txt>
        <Txt v="small">Audience: {audienceLabel}</Txt>
        <Txt v="small">Recipients: {result.recipients.length}</Txt>
        <Txt v="small">When: {when === 'now' ? 'Send now' : scheduledAt ? dateTime(scheduledAt) : 'Pick a time'}</Txt>
      </Card>

      <Tabs
        tabs={[
          { value: '0', label: '1 Audience' },
          { value: '1', label: '2 Compose' },
          { value: '2', label: '3 Review & send' },
        ]}
        value={String(step)}
        onChange={(v) => setStep(Number(v) as Step)}
      />

      {step === 0 ? (
        <Card>
          <SectionTitle title="Who receives this?" />
          <RadioGroup
            label="Channel"
            value={channel}
            onChange={setChannel}
            options={[
              { value: 'email', label: 'Email' },
              { value: 'sms', label: 'SMS', sub: 'Ghana numbers only' },
            ]}
          />
          {selection.length ? (
            <View style={{ backgroundColor: tones.blue.bg, padding: space.md, borderRadius: radius.md, marginBottom: space.md, gap: 6 }}>
              <Txt style={{ color: tones.blue.fg }}>
                Targeting {selection.length} selected contact(s). Carried over from your list selection. Filters are ignored while a selection is active.
              </Txt>
              <Button small variant="secondary" title="Use filters instead" style={{ alignSelf: 'flex-start' }} onPress={() => setSelection([])} />
            </View>
          ) : (
            <>
              <MultiSelect label="Send to" values={segmentIds} onChange={setSegmentIds} placeholder="All contacts" options={segments.map((s) => ({ value: s.id, label: s.name, sub: s.type === 'fixed' ? 'Fixed list' : 'Rules' }))} />
              <Txt v="label">Only if they match</Txt>
              <Row style={{ marginVertical: 8 }}>
                <Button small variant="secondary" icon={Filter} title={countConditions(rules) ? `${countConditions(rules)} condition(s)` : 'Add conditions'} onPress={() => setDrawer(true)} />
                {rules.children.length ? <Button small variant="ghost" title="Clear" onPress={() => setRules(emptyGroup())} /> : null}
              </Row>
              <MultiSelect label="Don't send to" values={excludeIds} onChange={setExcludeIds} placeholder="No one" options={segments.map((s) => ({ value: s.id, label: s.name }))} />
            </>
          )}
          <Checkbox label="Include opted-out contacts" helper="Only enable this for transactional or legally required messages." checked={includeOptedOut} onChange={setIncludeOptedOut} />
          <View style={{ backgroundColor: c.cardAlt, borderRadius: radius.md, padding: space.md, marginTop: space.sm, gap: 2 }}>
            <Txt v="h3">
              {result.recipients.length} will receive this {channel === 'email' ? 'email' : 'SMS'}
            </Txt>
            <Txt v="faint">{result.inAudience} in the audience</Txt>
            <Txt v="faint">
              {result.missingAddress} without {channel === 'email' ? 'an email address' : 'a phone number'}
            </Txt>
            {channel === 'sms' ? <Txt v="faint">{result.invalidNumber} not a Ghana number</Txt> : null}
            <Txt v="faint">
              {result.optedOut} unsubscribed from {channel === 'email' ? 'email' : 'SMS'}
              {includeOptedOut ? ' (included)' : ''}
            </Txt>
            {result.duplicates ? <Txt v="faint">{result.duplicates} duplicate address(es) removed</Txt> : null}
            {removed.size ? <Txt v="faint">{removed.size} removed by hand</Txt> : null}
          </View>
          <Button title="See and adjust recipients" variant="ghost" onPress={() => setRecipientsOpen(true)} />
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <SimNote
            text={
              channel === 'email'
                ? 'Sent via the Africon transactional sender. An unsubscribe link and our postal address are added to every email automatically. (Test build: delivery is simulated.)'
                : 'Sent via mNotify. SMS delivery is supported for Ghana numbers only. (Test build: delivery is simulated.)'
            }
          />
          <View style={{ height: space.md }} />
          <TextField label="Campaign name" required value={name} onChange={setName} helper="Internal" />
          {channel === 'email' ? (
            <>
              <TextField label="Subject" required value={subject} onChange={setSubject} />
              {chips('subject')}
              <TextField label="From name" optional value={fromName} onChange={setFromName} placeholder="Africon" />
              <TextField label="Reply-to" optional value={replyTo} onChange={setReplyTo} keyboardType="email-address" />
              <TextField label="Body" required multiline value={body} onChange={setBody} helper={`${body.length} characters`} />
              {chips('body')}
            </>
          ) : (
            <>
              <TextField label="Message" required multiline value={body} onChange={setBody} helper={`${body.length} chars · ${smsSegments(renderMergeTags(body, sample))} segments · each 160-character segment is billed separately`} />
              {chips('body')}
            </>
          )}
          <Row>
            <View style={{ flex: 1 }}>
              <TextField label={channel === 'email' ? 'Send yourself a test email' : 'Send yourself a test SMS'} value={testTo} onChange={setTestTo} keyboardType={channel === 'email' ? 'email-address' : 'phone-pad'} />
            </View>
            <Button title="Send test" variant="secondary" disabled={!testTo || !body} onPress={() => toast(`Test rendered for ${sample.fullName} and "sent" to ${testTo} (simulated). No campaign recorded.`, 'info')} />
          </Row>
          <SectionTitle title="Preview" />
          <Row style={{ marginBottom: 8 }}>
            <Tabs tabs={[{ value: 'rendered', label: 'Rendered' }, { value: 'plain', label: 'Plain text' }]} value={preview} onChange={setPreview} />
            {channel === 'email' ? <Tabs tabs={[{ value: 'desktop', label: 'Desktop' }, { value: 'mobile', label: 'Mobile' }]} value={device} onChange={setDevice} /> : null}
          </Row>
          <View style={{ alignSelf: device === 'mobile' || channel === 'sms' ? 'center' : 'stretch', width: device === 'mobile' || channel === 'sms' ? '85%' : '100%', borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: space.md, backgroundColor: channel === 'sms' ? tones.green.bg : c.card }}>
            {channel === 'email' ? (
              <>
                <Txt v="faint">From: {fromName || 'Africon'}</Txt>
                <Txt v="label">{preview === 'rendered' ? renderMergeTags(subject, sample) : subject}</Txt>
                <View style={{ height: 1, backgroundColor: c.border, marginVertical: 8 }} />
              </>
            ) : null}
            <Txt>{preview === 'rendered' ? renderMergeTags(body, sample) || '…' : body || '…'}</Txt>
            {channel === 'email' ? (
              <Txt v="faint" style={{ marginTop: 12 }}>
                Unsubscribe · Africon, Accra, Ghana
              </Txt>
            ) : null}
          </View>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <SectionTitle title="Review & send" />
          <Txt>Channel: {channel === 'email' ? 'Email' : 'SMS'}</Txt>
          <Txt>Name: {name || '—'}</Txt>
          {channel === 'email' ? <Txt>Subject: {subject || '—'}</Txt> : null}
          <Txt>Audience: {audienceLabel}</Txt>
          <Txt>Recipients: {result.recipients.length}</Txt>
          <View style={{ height: space.md }} />
          <RadioGroup
            label="When"
            value={when}
            onChange={setWhen}
            options={[
              { value: 'now', label: 'Send now' },
              { value: 'later', label: 'Schedule' },
            ]}
          />
          {when === 'later' ? <DateField mode="datetime" label="Send at (GMT)" value={scheduledAt} onChange={setScheduledAt} helper="Sends when the app is next opened after this time (test build)" /> : null}
          {/* TODO(spec): approval flow for campaigns was not observable (spec §16.1). Quiet hours not applied yet. */}
          <Button title={when === 'now' ? `Send to ${result.recipients.length}` : 'Schedule'} onPress={send} loading={busy} disabled={!canWrite || !result.recipients.length || !name.trim() || !body.trim() || (channel === 'email' && !subject.trim())} />
        </Card>
      ) : null}

      <Row style={{ justifyContent: 'space-between' }}>
        <Button title="Back" variant="secondary" disabled={step === 0} onPress={() => setStep((s) => (s - 1) as Step)} />
        {step < 2 ? <Button title="Continue" disabled={!canContinue} onPress={() => setStep((s) => (s + 1) as Step)} /> : null}
      </Row>

      <Card>
        <SectionTitle title="Recent campaigns" right={<IconButton icon={RefreshCw} label="Refresh" onPress={() => toast('Up to date', 'info')} />} />
        {campaigns.length === 0 ? <EmptyState title="No campaigns yet" /> : null}
        {campaigns.map((cp) => (
          <ListRow key={cp.id} style={{ marginBottom: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="label" style={{ flex: 1 }}>
                {cp.name}
              </Txt>
              <StatusPill value={cp.status} label={cp.status[0]!.toUpperCase() + cp.status.slice(1)} />
            </Row>
            <Txt v="faint">
              {cp.channel === 'email' ? 'Email' : 'SMS'} · {cp.audienceLabel}
            </Txt>
            <Txt v="small">
              {cp.recipients} recipients · {cp.sent} sent · {cp.failed} failed · {cp.sentAt ? dateTime(cp.sentAt) : cp.scheduledAt ? `scheduled ${dateTime(cp.scheduledAt)}` : '—'}
            </Txt>
            {cp.status === 'scheduled' && canWrite ? <Button small variant="dangerGhost" title="Cancel schedule" style={{ alignSelf: 'flex-start' }} onPress={() => cancelScheduledCampaign(cp.id).catch(toastError)} /> : null}
          </ListRow>
        ))}
      </Card>

      <FilterDrawer open={drawer} onClose={() => setDrawer(false)} value={rules} onApply={setRules} contacts={contacts} ctx={ctx} />

      <Sheet open={recipientsOpen} onClose={() => setRecipientsOpen(false)} title={`${result.recipients.length} recipients`} subtitle="Remove anyone who should not get this one">
        <FlatList
          data={result.recipients}
          keyExtractor={(x) => x.id}
          style={{ maxHeight: 460 }}
          renderItem={({ item }) => (
            <Row style={{ paddingVertical: 6 }}>
              <View style={{ flex: 1 }}>
                <Txt v="small">{item.fullName || item.email}</Txt>
                <Txt v="faint">{channel === 'email' ? item.email : item.phone}</Txt>
              </View>
              <IconButton icon={X} label={`Remove ${item.fullName}`} onPress={() => setRemoved((s) => new Set(s).add(item.id))} />
            </Row>
          )}
          ListFooterComponent={removed.size ? <Button title={`Restore ${removed.size} removed`} variant="ghost" onPress={() => setRemoved(new Set())} /> : undefined}
        />
      </Sheet>
    </Screen>
  );
}

