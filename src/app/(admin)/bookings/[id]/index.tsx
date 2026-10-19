import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useCurrentUser } from '@/auth/session';
import { ActivityFeed } from '@/components/ActivityFeed';
import { Select, TextField } from '@/components/form';
import { PageHeader, Screen } from '@/components/layout';
import { confirm, Sheet, toast, toastError } from '@/components/overlays';
import { Button, Card, EmptyState, KeyValue, Row, SectionTitle, StatusPill, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import { CapacityError, deleteBooking, transferBooking, updateBookingStatus } from '@/data/repo/bookings';
import { dateEntryLabel, eventFilterLabel } from '@/domain/eventLabels';
import type { BookingStatus } from '@/domain/types';
import { dateTime, eventDateLine, money, shortDate } from '@/lib/format';
import { BOOKING_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/labels';
import { can } from '@/lib/rbac';
import { radius, space, useTheme } from '@/theme';

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const me = useCurrentUser();
  const b = useDb((s) => s.bookings.find((x) => x.id === id));
  const events = useDb((s) => s.events);
  const audit = useDb((s) => s.audit);
  const contactId = useDb((s) => (b ? s.contacts.find((x) => x.email.toLowerCase() === b.customer.email.toLowerCase())?.id : undefined));
  const [transferOpen, setTransferOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const history = useMemo(() => audit.filter((a) => a.entityType === 'booking' && a.entityId === id), [audit, id]);

  if (!b) return <EmptyState title="Booking not found" body="It may have been deleted." />;
  const e = events.find((x) => x.id === b.eventId);
  const d = e?.dates.find((x) => x.id === b.eventDateId) ?? e?.dates[0];
  const canWrite = can(me, 'write:bookings');
  const targetEvent = events.find((x) => x.id === target);

  const onDelete = async () => {
    if (!(await confirm({ title: 'Delete booking?', message: `${b.ref} for ${b.customer.fullName} will be permanently deleted.`, confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await deleteBooking(b.id);
      toast(`${b.ref} deleted`);
      router.back();
    } catch (err) {
      toastError(err);
    }
  };

  const onStatus = async (s: BookingStatus) => {
    try {
      await updateBookingStatus(b.id, s);
      toast(`Status set to ${BOOKING_STATUS_LABELS[s]}`);
    } catch (err) {
      toastError(err);
    }
  };

  const doTransfer = async (override = false) => {
    try {
      await transferBooking(b.id, target, targetDate, notes, { overrideCapacity: override });
      toast(`${b.ref} moved to ${targetEvent?.title}`);
      setTransferOpen(false);
      setTarget('');
      setNotes('');
    } catch (err) {
      if (err instanceof CapacityError) {
        const ok = await confirm({ title: 'Target event is full', message: `${err.message.split('.')[0]}. Transfer anyway?`, confirmLabel: 'Override capacity', destructive: true });
        if (ok) return doTransfer(true);
      } else toastError(err);
    }
  };

  return (
    <Screen>
      <PageHeader
        title={`Booking ${b.ref}`}
        description={`Created ${dateTime(b.createdAt)}`}
        actions={
          <>
            {canWrite ? <Button title="Edit" onPress={() => router.push(`/bookings/${b.id}/edit`)} /> : null}
            {canWrite ? <Button title="Transfer" variant="secondary" onPress={() => setTransferOpen(true)} /> : null}
            {can(me, 'delete:bookings') ? <Button title="Delete" variant="danger" onPress={onDelete} /> : null}
          </>
        }
      />
      <Card>
        <Row wrap gap={8}>
          <StatusPill value={b.status} label={BOOKING_STATUS_LABELS[b.status]} />
          <StatusPill value={b.paymentStatus} label={PAYMENT_STATUS_LABELS[b.paymentStatus]} />
        </Row>
        <View style={{ marginTop: space.md, gap: 8 }}>
          <Button title="Send Reminder" variant="secondary" disabled accessibilityHint="Send reminder is currently disabled" />
          <Txt v="faint">Send reminder is currently disabled</Txt>
          {canWrite ? (
            <Select
              label="Update Status"
              value={b.status}
              onChange={onStatus}
              options={(Object.keys(BOOKING_STATUS_LABELS) as BookingStatus[]).map((s) => ({ value: s, label: BOOKING_STATUS_LABELS[s] }))}
            />
          ) : null}
        </View>
      </Card>
      <Card>
        <SectionTitle title="Customer Information" right={contactId ? <Button small variant="ghost" title="Open in CRM" onPress={() => router.push(`/crm/${contactId}`)} /> : null} />
        <KeyValue label="Full Name" value={b.customer.fullName} />
        <KeyValue label="Email Address" value={b.customer.email} />
        <KeyValue label="Phone Number" value={b.customer.phone} />
        <KeyValue label="Company/Institution" value={b.customer.company} />
        <KeyValue label="Role" value={b.customer.role} />
        <KeyValue label="Occupation" value={b.customer.occupation} />
      </Card>
      <Card>
        <SectionTitle title="Event Information" right={e ? <Button small variant="ghost" title="Open event" onPress={() => router.push(`/events/${e.id}`)} /> : null} />
        <KeyValue label="Event Title" value={e?.title ?? 'Deleted event'} />
        <KeyValue label="Date & Time" value={d ? eventDateLine(d.date, d.startTime, d.endTime) : '—'} />
        <KeyValue label="Location" value={d?.location} />
        <KeyValue label="Venue" value={d?.venue} />
        <KeyValue label="Attendees" value={b.attendees} />
      </Card>
      {d ? (
        <Card>
          <SectionTitle title="Selected Session" />
          <KeyValue label="Session" value={dateEntryLabel(d)} />
          <KeyValue label="Session Date" value={shortDate(d.date)} />
          <KeyValue label="Session Time" value={`${d.startTime}${d.endTime ? ` - ${d.endTime}` : ''}`} />
          <KeyValue label="Session Venue" value={d.venue} />
          <KeyValue label="Session Location" value={d.location} />
        </Card>
      ) : null}
      <Card>
        <SectionTitle title="Payment Information" />
        <KeyValue label="Total Amount" value={money(b.total, b.currency)} />
        {b.discountAmount > 0 ? <KeyValue label="Discount" value={`${b.discountCode} · ${b.discountLabel} (−${money(b.discountAmount, b.currency)})`} /> : null}
        <KeyValue label="Amount Paid" value={money(b.amountPaid, b.currency)} />
        <KeyValue label="Payment Status" value={PAYMENT_STATUS_LABELS[b.paymentStatus]} />
        <KeyValue label="Payment Method" value={PAYMENT_METHOD_LABELS[b.paymentMethod].toUpperCase()} />
        <KeyValue label="Transaction Reference" value={b.transactionRef} />
      </Card>
      <Card>
        <SectionTitle title="Additional Information" />
        <KeyValue label="Source" value={b.source} />
        <KeyValue label="How they heard" value={b.heardAbout} />
        <KeyValue label="Special Requirements" value={b.specialRequirements} />
        <KeyValue label="Internal Notes" value={b.internalNotes} />
        <KeyValue label="Tags" value={b.tags.join(', ')} />
        <KeyValue label="Messages" value={`${b.emailsSent} emails · ${b.smsSent} SMS`} />
      </Card>
      <Card>
        <SectionTitle title="Activity" />
        <ActivityFeed entries={history} showToggle={false} absoluteTime />
      </Card>

      <Sheet
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="Transfer Booking"
        subtitle="Move this booking to a different event"
        scroll
        footer={
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button title="Cancel" variant="secondary" onPress={() => setTransferOpen(false)} />
            <Button title="Transfer Booking" onPress={() => doTransfer()} disabled={!target} />
          </Row>
        }>
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: space.md, marginBottom: space.md, backgroundColor: c.cardAlt }}>
          <Txt v="caps">Current booking</Txt>
          <Txt v="label">
            {b.ref} · {b.attendees} attendee{b.attendees === 1 ? '' : 's'}
          </Txt>
          <Txt v="small">
            {b.customer.fullName} · {b.customer.email}
          </Txt>
          <Txt v="faint">
            From: {e?.title} {d ? `· ${shortDate(d.date)}` : ''} · {e ? money(e.price, e.currency) : ''}
          </Txt>
        </View>
        <Select
          label="Transfer To"
          required
          value={target}
          searchable
          onChange={(v) => {
            setTarget(v);
            setTargetDate(events.find((x) => x.id === v)?.dates[0]?.id ?? null);
          }}
          options={events.filter((x) => x.id !== b.eventId || x.dates.length > 1).map((x) => ({ value: x.id, label: eventFilterLabel(x) }))}
        />
        {targetEvent && targetEvent.dates.length > 1 ? (
          <Select label="Session" value={targetDate ?? ''} onChange={setTargetDate} options={targetEvent.dates.map((x) => ({ value: x.id, label: dateEntryLabel(x) }))} />
        ) : null}
        <TextField label="Transfer Notes" optional multiline value={notes} onChange={setNotes} maxLength={500} counter />
      </Sheet>
    </Screen>
  );
}
