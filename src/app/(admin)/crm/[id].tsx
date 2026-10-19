import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Mail, MessageSquare, Pencil, Tag, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useCurrentUser } from '@/auth/session';
import { Checkbox, NumberField, Select, TextField } from '@/components/form';
import { PageHeader, Screen } from '@/components/layout';
import { confirm, Sheet, toast, toastError } from '@/components/overlays';
import { Button, Card, EmptyState, KeyValue, Pill, Row, SectionTitle, StatusPill, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import { addPaymentAdvice, addTags, deleteContact, mergeDuplicate, removeTag, reviewPaymentAdvice, updateContact } from '@/data/repo/crm';
import type { Contact } from '@/domain/types';
import { openCampaign } from '@/features/crm/shared';
import { dateTime, money, relativeTime } from '@/lib/format';
import { can } from '@/lib/rbac';
import { radius, space, useTheme } from '@/theme';

type EditFields = Pick<Contact, 'fullName' | 'email' | 'phone' | 'company' | 'jobTitle' | 'country' | 'city' | 'notes' | 'internalNotes' | 'emailOptOut' | 'smsOptOut' | 'marketingConsent'>;

export default function ContactDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, tones } = useTheme();
  const me = useCurrentUser();
  const contact = useDb((s) => s.contacts.find((x) => x.id === id));
  const allContacts = useDb((s) => s.contacts);
  const activities = useDb((s) => s.activities);
  const advice = useDb((s) => s.paymentAdvice);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditFields | null>(null);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagText, setTagText] = useState('');
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeId, setMergeId] = useState('');
  const [adviceOpen, setAdviceOpen] = useState(false);
  const [pa, setPa] = useState({ fileUri: '', fileName: '', amount: null as number | null, method: 'Bank transfer', reference: '' });

  const acts = useMemo(() => activities.filter((a) => a.contactId === id).sort((a, b) => b.at.localeCompare(a.at)), [activities, id]);
  const myAdvice = advice.filter((p) => p.contactId === id);
  const canWrite = can(me, 'write:bookings');

  if (!contact) return <EmptyState title="Contact not found" body="It may have been merged or deleted." />;

  const startEdit = () => {
    const { fullName, email, phone, company, jobTitle, country, city, notes, internalNotes, emailOptOut, smsOptOut, marketingConsent } = contact;
    setForm({ fullName, email, phone, company, jobTitle, country, city, notes, internalNotes, emailOptOut, smsOptOut, marketingConsent });
    setEditing(true);
  };
  const saveEdit = async () => {
    try {
      await updateContact(contact.id, form!);
      toast('Contact saved');
      setEditing(false);
    } catch (e) {
      toastError(e);
    }
  };
  const onDelete = async () => {
    if (!(await confirm({ title: 'Delete contact?', message: `${contact.fullName || contact.email} and their activity will be permanently deleted.`, confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await deleteContact(contact.id);
      toast('Contact deleted');
      router.back();
    } catch (e) {
      toastError(e);
    }
  };
  const pickProof = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (!r.canceled) setPa((x) => ({ ...x, fileUri: r.assets[0]!.uri, fileName: r.assets[0]!.name }));
  };
  const f = form;
  const setF = <K extends keyof EditFields>(k: K, v: EditFields[K]) => setForm((x) => (x ? { ...x, [k]: v } : x));
  const merged = allContacts.find((x) => x.id === mergeId);

  return (
    <Screen>
      <PageHeader
        title={contact.fullName || contact.email || contact.phone}
        description={[contact.jobTitle, contact.company].filter(Boolean).join(' · ') || 'Contact details'}
        actions={
          <>
            {canWrite ? <Button small icon={Mail} title="Email" variant="secondary" disabled={!contact.email} onPress={() => openCampaign({ channel: 'email', contactIds: [contact.id] })} /> : null}
            {canWrite ? <Button small icon={MessageSquare} title="SMS" variant="secondary" disabled={!contact.phone} onPress={() => openCampaign({ channel: 'sms', contactIds: [contact.id] })} /> : null}
            {canWrite ? <Button small icon={Tag} title="Add tag" variant="secondary" onPress={() => setTagOpen(true)} /> : null}
            {canWrite && !editing ? <Button small icon={Pencil} title="Edit" onPress={startEdit} /> : null}
            {canWrite ? <Button small icon={Trash2} title="Delete" variant="danger" onPress={onDelete} /> : null}
          </>
        }
      />
      <Row wrap gap={6}>
        <Pill label={contact.lifecycleStage === 'customer' ? 'Customer' : 'Lead'} tone={contact.lifecycleStage === 'customer' ? 'green' : 'blue'} />
        {contact.needsReview ? <Pill label="Needs review · possible duplicate" tone="amber" /> : null}
        {contact.sources.map((s, i) => (
          <Pill key={s} label={`${s}${i === 0 ? ' · primary' : ''}`} />
        ))}
      </Row>

      <Card>
        <SectionTitle title="Identity" />
        {editing && f ? (
          <>
            <TextField label="Full name" value={f.fullName} onChange={(v) => setF('fullName', v)} />
            <TextField label="Email" value={f.email} onChange={(v) => setF('email', v)} keyboardType="email-address" />
            <TextField label="Phone" value={f.phone} onChange={(v) => setF('phone', v)} keyboardType="phone-pad" />
            <TextField label="Company" value={f.company} onChange={(v) => setF('company', v)} />
            <TextField label="Job title" value={f.jobTitle} onChange={(v) => setF('jobTitle', v)} />
            <TextField label="Country" value={f.country} onChange={(v) => setF('country', v)} />
            <TextField label="City" value={f.city} onChange={(v) => setF('city', v)} />
            <TextField label="Notes" multiline value={f.notes} onChange={(v) => setF('notes', v)} />
            <TextField label="Internal notes" multiline value={f.internalNotes} onChange={(v) => setF('internalNotes', v)} />
            <Checkbox label="Email opt-out" checked={f.emailOptOut} onChange={(v) => setF('emailOptOut', v)} />
            <Checkbox label="SMS opt-out" checked={f.smsOptOut} onChange={(v) => setF('smsOptOut', v)} />
            <Checkbox label="Marketing consent" checked={f.marketingConsent} onChange={(v) => setF('marketingConsent', v)} />
            <Row style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              <Button title="Cancel" variant="secondary" onPress={() => setEditing(false)} />
              <Button title="Save changes" onPress={saveEdit} />
            </Row>
          </>
        ) : (
          <>
            <KeyValue label="Email" value={contact.email} />
            <KeyValue label="Phone" value={contact.phone || 'No phone'} />
            <KeyValue label="Company" value={contact.company} />
            <KeyValue label="Job title" value={contact.jobTitle} />
            <KeyValue label="Location" value={[contact.city, contact.country].filter(Boolean).join(', ')} />
            <KeyValue label="Tags">
              {contact.tags.length ? (
                <Row wrap gap={6}>
                  {contact.tags.map((t) => (
                    <Pressable
                      key={t}
                      disabled={!canWrite}
                      onPress={() => removeTag(contact.id, t).catch(toastError)}
                      accessibilityLabel={`Remove tag ${t}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: tones.blue.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: tones.blue.fg, fontSize: 12 }}>{t}</Text>
                      {canWrite ? <X size={12} color={tones.blue.fg} /> : null}
                    </Pressable>
                  ))}
                </Row>
              ) : (
                <Txt>—</Txt>
              )}
            </KeyValue>
            <KeyValue label="Notes" value={contact.notes} />
            <KeyValue label="Internal notes" value={contact.internalNotes} />
            <KeyValue label="Consent" value={`Email ${contact.emailOptOut ? 'opted out' : 'OK'} · SMS ${contact.smsOptOut ? 'opted out' : 'OK'} · Marketing ${contact.marketingConsent ? 'yes' : 'no'}`} />
          </>
        )}
      </Card>

      <Card>
        <SectionTitle title="Revenue" />
        <KeyValue label="TOTAL SPENT" value={contact.totalSpent.length ? contact.totalSpent.map((m) => money(m.amount, m.currency)).join(' · ') : money(0)} />
        <KeyValue label="Paid bookings" value={contact.paidBookingsCount} />
        <KeyValue label="Customer since" value={contact.customerSince ? dateTime(contact.customerSince) : '—'} />
        <KeyValue label="Last booking" value={contact.lastPaidBookingAt ? dateTime(contact.lastPaidBookingAt) : '—'} />
        <KeyValue label="Last activity" value={relativeTime(contact.lastActivityAt)} />
      </Card>

      <Card>
        <SectionTitle title="Messaging" />
        <KeyValue label="Emails sent" value={contact.emailsSent} />
        <KeyValue label="Last email" value={contact.lastEmailAt ? dateTime(contact.lastEmailAt) : 'Never'} />
        <KeyValue label="SMS sent" value={contact.smsSent} />
        <KeyValue label="Last SMS" value={contact.lastSmsAt ? dateTime(contact.lastSmsAt) : 'Never'} />
      </Card>

      <Card>
        <SectionTitle title="Payment advice" sub="Upload a proof of payment to record an offline transaction. Approving it converts a lead into a customer." right={canWrite ? <Button small title="Upload" variant="secondary" onPress={() => setAdviceOpen(true)} /> : null} />
        {myAdvice.length === 0 ? <Txt v="muted">No payment advice yet</Txt> : null}
        {myAdvice.map((p) => (
          <View key={p.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border, gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="label">
                {money(p.amount)} · {p.method}
              </Txt>
              <StatusPill value={p.status} label={p.status[0]!.toUpperCase() + p.status.slice(1)} />
            </Row>
            <Txt v="faint">
              {p.fileName} · {p.reference || 'No reference'} · {dateTime(p.at)}
            </Txt>
            {p.status === 'pending' && canWrite ? (
              <Row>
                <Button small title="Approve" onPress={() => reviewPaymentAdvice(p.id, 'approved').then(() => toast('Approved: contact is now a customer')).catch(toastError)} />
                <Button small title="Reject" variant="secondary" onPress={() => reviewPaymentAdvice(p.id, 'rejected').catch(toastError)} />
              </Row>
            ) : null}
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle title="Activity" />
        {acts.length === 0 ? <Txt v="muted">No activity yet.</Txt> : null}
        {acts.map((a) => (
          <View key={a.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Pill label={a.source.startsWith('campaign:') ? 'Campaign' : a.source} />
              <Txt v="faint">{dateTime(a.at)}</Txt>
            </Row>
            <Txt style={{ marginTop: 4 }}>{a.summary}</Txt>
            {a.amount ? <Txt v="faint">{money(a.amount.amount, a.amount.currency)}</Txt> : null}
            {a.bookingId ? <Button small variant="ghost" title="Open booking" style={{ alignSelf: 'flex-start' }} onPress={() => router.push(`/bookings/${a.bookingId}`)} /> : null}
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle title="Record" />
        <KeyValue label="Created" value={dateTime(contact.createdAt)} />
        <KeyValue label="Updated" value={dateTime(contact.updatedAt)} />
        <KeyValue label="First source" value={contact.firstSource} />
        <KeyValue label="ID" value={contact.id} />
        {canWrite ? <Button title="Merge a duplicate in" variant="secondary" onPress={() => setMergeOpen(true)} style={{ marginTop: space.sm }} /> : null}
      </Card>

      <Sheet
        open={tagOpen}
        onClose={() => setTagOpen(false)}
        title="Add tag"
        footer={
          <Button
            title="Add"
            disabled={!tagText.trim()}
            onPress={() =>
              addTags([contact.id], tagText.split(','))
                .then(() => {
                  setTagOpen(false);
                  setTagText('');
                })
                .catch(toastError)
            }
          />
        }>
        <TextField label="Tags" value={tagText} onChange={setTagText} helper="Separate several with commas" autoCapitalize="none" />
      </Sheet>

      <Sheet
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        title="Merge a duplicate in"
        subtitle="Activities are kept, the newest identity fields win, revenue is summed, then the duplicate is deleted."
        footer={
          <Button
            title="Merge"
            variant="danger"
            disabled={!mergeId}
            onPress={async () => {
              if (!(await confirm({ title: 'Merge contacts?', message: `${merged?.fullName || merged?.email} will be merged into ${contact.fullName || contact.email} and deleted.`, confirmLabel: 'Merge', destructive: true }))) return;
              try {
                await mergeDuplicate(contact.id, mergeId);
                toast('Contacts merged');
                setMergeOpen(false);
                setMergeId('');
              } catch (e) {
                toastError(e);
              }
            }}
          />
        }>
        <Select
          label="Duplicate contact"
          value={mergeId}
          onChange={setMergeId}
          searchable
          options={allContacts
            .filter((x) => x.id !== contact.id)
            .sort((a, b) => Number(b.fullName === contact.fullName) - Number(a.fullName === contact.fullName))
            .map((x) => ({ value: x.id, label: x.fullName || x.email || x.phone, sub: `${x.email || 'no email'} · ${x.phone || 'no phone'}` }))}
        />
      </Sheet>

      <Sheet
        open={adviceOpen}
        onClose={() => setAdviceOpen(false)}
        title="Upload payment advice"
        scroll
        footer={
          <Button
            title="Upload"
            disabled={!pa.fileUri || !pa.amount}
            onPress={async () => {
              try {
                await addPaymentAdvice(contact.id, { fileUri: pa.fileUri, fileName: pa.fileName, amount: pa.amount ?? 0, method: pa.method, reference: pa.reference });
                toast('Payment advice recorded; approve it to count the payment');
                setAdviceOpen(false);
                setPa({ fileUri: '', fileName: '', amount: null, method: 'Bank transfer', reference: '' });
              } catch (e) {
                toastError(e);
              }
            }}
          />
        }>
        <Button title={pa.fileName ? `File: ${pa.fileName}` : 'Choose proof of payment (image or PDF)'} variant="secondary" onPress={pickProof} style={{ marginBottom: space.md }} />
        <NumberField label="Amount (GHS)" required value={pa.amount} onChange={(v) => setPa((x) => ({ ...x, amount: v }))} />
        <Select label="Method" value={pa.method} onChange={(v) => setPa((x) => ({ ...x, method: v }))} options={['Bank transfer', 'Mobile money', 'Cash', 'Cheque', 'Card terminal'].map((m) => ({ value: m, label: m }))} />
        <TextField label="Reference" optional value={pa.reference} onChange={(v) => setPa((x) => ({ ...x, reference: v }))} />
      </Sheet>
    </Screen>
  );
}
