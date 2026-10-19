import { router, usePreventRemove } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ChipInput, NumberField, Select, TextField } from '@/components/form';
import { Screen } from '@/components/layout';
import { confirm, toast, toastError } from '@/components/overlays';
import { Button, Card, KeyValue, Row, SectionTitle, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import { CapacityError, createBooking, updateBooking } from '@/data/repo/bookings';
import { dateEntryLabel, eventPickerLabel } from '@/domain/eventLabels';
import { bookingFormSchema, fieldErrors, type BookingForm } from '@/domain/schemas';
import type { Booking } from '@/domain/types';
import { capacityFor, seatsTaken } from '@/lib/capacity';
import { money, shortDate } from '@/lib/format';
import { BOOKING_STATUS_LABELS, OCCUPATIONS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/labels';
import { findDiscount, quote } from '@/lib/pricing';

export function emptyBookingForm(eventId = ''): BookingForm {
  return {
    eventId,
    eventDateId: null,
    fullName: '',
    email: '',
    phone: '',
    occupation: 'Not specified',
    company: '',
    role: '',
    heardAbout: '',
    discountCode: '',
    attendees: 1,
    amountPaid: null,
    status: 'pending',
    paymentStatus: 'pending',
    paymentMethod: 'paystack',
    transactionRef: '',
    specialRequirements: '',
    internalNotes: '',
    tags: [],
  };
}

export function formFromBooking(b: Booking): BookingForm {
  return {
    eventId: b.eventId,
    eventDateId: b.eventDateId,
    fullName: b.customer.fullName,
    email: b.customer.email,
    phone: b.customer.phone,
    occupation: b.customer.occupation || 'Not specified',
    company: b.customer.company,
    role: b.customer.role,
    heardAbout: b.heardAbout,
    discountCode: b.discountCode,
    attendees: b.attendees,
    amountPaid: b.amountPaid,
    status: b.status,
    paymentStatus: b.paymentStatus,
    paymentMethod: b.paymentMethod,
    transactionRef: b.transactionRef,
    specialRequirements: b.specialRequirements,
    internalNotes: b.internalNotes,
    tags: b.tags,
  };
}

const enumOpts = <T extends string>(labels: Record<T, string>) => (Object.keys(labels) as T[]).map((k) => ({ value: k, label: labels[k] }));

/** Create / edit booking form (spec §5.5). */
export function BookingFormScreen({ existing }: { existing?: Booking }) {
  const events = useDb((s) => s.events);
  const bookings = useDb((s) => s.bookings);
  const discounts = useDb((s) => s.discounts);
  const heardSources = useDb((s) => s.metadata.heardAboutSources);
  const [f, setF] = useState<BookingForm>(() => (existing ? formFromBooking(existing) : emptyBookingForm()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [codeInput, setCodeInput] = useState(f.discountCode);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const isEdit = !!existing;

  const disablePrevention = usePreventRemove(dirty, ({ repeat }) => {
    confirm({ title: 'Discard changes?', message: 'This booking has unsaved changes.', confirmLabel: 'Discard', destructive: true }).then((ok) => {
      if (ok) {
        setDirty(false);
        repeat();
      }
    });
  });

  const set = <K extends keyof BookingForm>(k: K, v: BookingForm[K]) => {
    setDirty(true);
    setF((x) => ({ ...x, [k]: v }));
  };

  const ev = events.find((e) => e.id === f.eventId);
  const discount = f.discountCode ? findDiscount(discounts, f.discountCode) : null;
  const q = ev ? quote(ev, f.attendees, f.eventDateId, discount) : null;
  const isFree = q?.isFree ?? false;
  const cap = ev ? capacityFor(ev, f.eventDateId) : 0;
  const taken = ev ? seatsTaken(bookings, ev.id, f.eventDateId, existing?.id) : 0;
  const d = ev?.dates.find((x) => x.id === f.eventDateId) ?? ev?.dates[0];

  const eventOptions = useMemo(
    () => [...events].sort((a, b) => a.title.localeCompare(b.title)).map((e) => ({ value: e.id, label: eventPickerLabel(e), sub: e.status })),
    [events],
  );

  const pickEvent = (id: string) => {
    const e = events.find((x) => x.id === id)!;
    setDirty(true);
    setF((x) => ({
      ...x,
      eventId: id,
      eventDateId: e.dates[0]?.id ?? null,
      ...(e.price === 0 ? { paymentStatus: 'not_required' as const, paymentMethod: 'free' as const, discountCode: '' } : x.paymentMethod === 'free' ? { paymentStatus: 'pending' as const, paymentMethod: 'paystack' as const } : {}),
    }));
    if (e.price === 0) setCodeInput('');
  };

  const applyCode = () => {
    const code = codeInput.trim();
    if (!code) return set('discountCode', '');
    const found = findDiscount(discounts, code);
    if (!found) return toast(`"${code}" is not a valid code`, 'error');
    if (ev && !ev.options.allowDiscounts) return toast('This event does not allow discount codes', 'error');
    set('discountCode', found.code);
    toast(`${found.label} applied`);
  };

  const save = async (override = false) => {
    const r = bookingFormSchema.safeParse(f);
    if (!r.success) {
      setErrors(fieldErrors(r.error));
      toast('Fix the highlighted fields first', 'error');
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const saved = isEdit ? await updateBooking(existing.id, f, { overrideCapacity: override }) : await createBooking(f, { overrideCapacity: override });
      setDirty(false);
      disablePrevention();
      toast(saved.status === 'waitlist' ? `${saved.ref} added to the waitlist` : isEdit ? 'Booking updated' : `Booking ${saved.ref} created`);
      router.replace(`/bookings/${saved.id}`);
    } catch (e) {
      if (e instanceof CapacityError) {
        const ok = await confirm({
          title: 'Event is full',
          message: `${e.message}\n\nOverride and book anyway?`,
          confirmLabel: 'Override capacity',
          destructive: true,
        });
        if (ok) return save(true);
        // Not overriding: book onto the waitlist instead.
        try {
          const saved = isEdit ? await updateBooking(existing.id, f, { allowWaitlist: true }) : await createBooking(f, { allowWaitlist: true });
          setDirty(false);
          disablePrevention();
          toast(`${saved.ref} added to the waitlist`, 'info');
          router.replace(`/bookings/${saved.id}`);
        } catch (e2) {
          toastError(e2);
        }
      } else toastError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View>
        <Txt v="h1">{isEdit ? 'Edit Booking' : 'Create New Booking'}</Txt>
        <Txt v="muted">{isEdit ? `Update booking details and information · ${existing.ref}` : 'Book someone onto an event from the office'}</Txt>
      </View>
      <Card>
        <Select label="Event" required value={f.eventId} options={eventOptions} onChange={pickEvent} error={errors.eventId} searchable />
        {ev ? (
          <View style={{ gap: 2 }}>
            {ev.dates.length > 1 ? (
              <Select label="Session" value={f.eventDateId ?? ''} onChange={(v) => set('eventDateId', v)} options={ev.dates.map((x) => ({ value: x.id, label: dateEntryLabel(x) }))} />
            ) : null}
            <SectionTitle title="Selected Event Details" />
            <KeyValue label="Date" value={d ? shortDate(d.date) : '—'} />
            <KeyValue label="Time" value={d ? `${d.startTime}${d.endTime ? ` - ${d.endTime}` : ''}` : '—'} />
            <KeyValue label="Price" value={isFree ? 'Free' : money(q?.unitPrice ?? ev.price, ev.currency)} />
            <KeyValue label="Location" value={d ? [d.venue, d.location].filter(Boolean).join(', ') : '—'} />
            <KeyValue label="Registered" value={`${taken}/${cap} registered`} />
          </View>
        ) : null}
      </Card>
      <Card>
        <SectionTitle title="Customer" />
        <TextField label="Full Name" required value={f.fullName} onChange={(v) => set('fullName', v)} error={errors.fullName} />
        <TextField label="Email Address" required value={f.email} onChange={(v) => set('email', v)} keyboardType="email-address" error={errors.email} />
        <TextField label="Phone Number" value={f.phone} onChange={(v) => set('phone', v)} keyboardType="phone-pad" placeholder="024 123 4567" />
        <Select label="Occupation" value={f.occupation} onChange={(v) => set('occupation', v)} options={OCCUPATIONS.map((o) => ({ value: o, label: o }))} />
        <TextField label="Company / School" value={f.company} onChange={(v) => set('company', v)} />
        <TextField label="Role" value={f.role} onChange={(v) => set('role', v)} />
        <Select label="How did you hear about this?" required value={f.heardAbout} onChange={(v) => set('heardAbout', v)} options={heardSources.map((o) => ({ value: o, label: o }))} error={errors.heardAbout} />
      </Card>
      <Card>
        <SectionTitle title="Payment" />
        <Txt v="label">Discount Code</Txt>
        <Row style={{ marginTop: 6 }}>
          <View style={{ flex: 1 }}>
            <TextField value={codeInput} onChange={setCodeInput} autoCapitalize="none" editable={!!ev && !isFree} placeholder={!ev || isFree ? '(Select a paid event to enable)' : 'CODE'} />
          </View>
          <Button title="Apply" variant="secondary" onPress={applyCode} disabled={!ev || isFree} />
        </Row>
        <NumberField label="Number of Attendees" value={f.attendees} onChange={(v) => set('attendees', v ?? 1)} error={errors.attendees} />
        {q ? (
          <Card style={{ marginBottom: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="muted">Calculated total</Txt>
              <Txt v="h3">{money(q.total, ev!.currency)}</Txt>
            </Row>
            {q.discountAmount > 0 ? (
              <Txt v="faint">
                {money(q.subtotal, ev!.currency)} − {money(q.discountAmount, ev!.currency)} ({q.discountLabel})
              </Txt>
            ) : null}
          </Card>
        ) : null}
        {isEdit ? (
          <>
            <NumberField label="Amount Paid" value={f.amountPaid} onChange={(v) => set('amountPaid', v)} />
            <Button title="Use calculated total" variant="ghost" small style={{ alignSelf: 'flex-start', marginTop: -6, marginBottom: 8 }} onPress={() => q && set('amountPaid', q.total)} />
          </>
        ) : null}
        <Select label="Booking Status" value={f.status} onChange={(v) => set('status', v)} options={enumOpts(BOOKING_STATUS_LABELS)} />
        <Select
          label="Payment Status"
          value={f.paymentStatus}
          onChange={(v) => set('paymentStatus', v)}
          disabled={isFree}
          helper={isFree ? 'Free events are always "Not Required"' : undefined}
          options={enumOpts(PAYMENT_STATUS_LABELS).map((o) => (o.value === 'pay_later' ? { ...o, label: 'Pay Later (reserved, awaiting payment)' } : o))}
        />
        <Select label="Payment Method" value={f.paymentMethod} onChange={(v) => set('paymentMethod', v)} disabled={isFree} options={enumOpts(PAYMENT_METHOD_LABELS)} />
        <TextField label="Transaction Reference" value={f.transactionRef} onChange={(v) => set('transactionRef', v)} autoCapitalize="none" />
      </Card>
      <Card>
        <TextField label="Special Requirements" multiline value={f.specialRequirements} onChange={(v) => set('specialRequirements', v)} helper="Visible to the customer" />
        <TextField label="Internal Notes" multiline value={f.internalNotes} onChange={(v) => set('internalNotes', v)} helper="Not visible to customer" />
        <ChipInput label="Tags" values={f.tags} onChange={(v) => set('tags', v)} />
      </Card>
      <Row style={{ justifyContent: 'flex-end' }}>
        <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
        <Button title={isEdit ? 'Update Booking' : 'Create Booking'} onPress={() => save()} loading={busy} />
      </Row>
    </Screen>
  );
}
