import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { ImageList, RepeatList, StringList } from '@/components/editors';
import { Checkbox, ChipInput, DateField, NumberField, RadioGroup, Select, SwitchRow, TextField } from '@/components/form';
import { Button, Card, Row, SectionTitle, SimNote, Txt } from '@/components/ui';
import { blankEventDate, blankSpeaker } from '@/domain/defaults';
import type { eventStepSchemas } from '@/domain/schemas';
import { dateEntryLabel } from '@/domain/eventLabels';
import type { EventItem, EventMetadata, Speaker } from '@/domain/types';
import { slugify } from '@/lib/format';
import { TIMEZONES } from '@/lib/labels';
import { space } from '@/theme';

export interface StepProps {
  e: EventItem;
  set: (patch: Partial<EventItem>) => void;
  errors: Record<string, string>;
  meta: EventMetadata;
  slugTouched: boolean;
  setSlugTouched: (v: boolean) => void;
}

const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));

export const STEPS = [
  { key: 'basic', label: 'Basic Info', sub: 'Title, category & status' },
  { key: 'schedule', label: 'Schedule', sub: 'Dates, times & timezone' },
  { key: 'instructor', label: 'Instructor', sub: 'Speaker information' },
  { key: 'details', label: 'Details', sub: 'Prerequisites & inclusions' },
  { key: 'page', label: 'Page Content', sub: 'About, outcomes, agenda, FAQs' },
  { key: 'pricing', label: 'Pricing', sub: 'Price, currency & capacity' },
  { key: 'media', label: 'Media', sub: 'Images, video & brochure' },
  { key: 'settings', label: 'Settings', sub: 'Options & email templates' },
  { key: 'booking', label: 'Booking', sub: 'Managed checkout, questions & invoices' },
  { key: 'registration', label: 'Registration', sub: 'Reviewed requests, roles & questions' },
  { key: 'seo', label: 'Location & SEO', sub: 'Region, tags & meta' },
] as const;
export type StepKey = (typeof STEPS)[number]['key'];

/** Which zod step schema validates each wizard step (see eventStepSchemas). */
export const STEP_SCHEMA: Partial<Record<StepKey, keyof typeof eventStepSchemas>> = {
  basic: 'basic',
  schedule: 'schedule',
  instructor: 'instructor',
  details: 'details',
  pricing: 'pricing',
  media: 'media',
  seo: 'seo',
};

export function BasicStep({ e, set, errors, meta, slugTouched, setSlugTouched }: StepProps) {
  const [newCat, setNewCat] = useState('');
  const categories = Array.from(new Set([...meta.categories, ...(e.category ? [e.category] : [])]));
  return (
    <Card>
      <Select
        label="Category"
        required
        value={e.category}
        options={opts(categories)}
        onChange={(v) => set({ category: v })}
        error={errors.category}
        placeholder="Choose a category, or type a new one"
      />
      <Row>
        <View style={{ flex: 1 }}>
          <TextField value={newCat} onChange={setNewCat} placeholder="…or type a new category" />
        </View>
        <Button
          title="Use"
          variant="secondary"
          disabled={!newCat.trim()}
          onPress={() => {
            set({ category: newCat.trim() });
            setNewCat('');
          }}
        />
      </Row>
      <RadioGroup
        label="Format *"
        value={e.format}
        onChange={(v) => set({ format: v })}
        options={[
          { value: 'in_person', label: 'In Person' },
          { value: 'virtual', label: 'Virtual' },
          { value: 'hybrid', label: 'Hybrid' },
        ]}
      />
      <TextField
        label="Event Title"
        required
        value={e.title}
        error={errors.title}
        onChange={(v) => set(slugTouched ? { title: v } : { title: v, slug: slugify(v) })}
      />
      <TextField
        label="URL Slug"
        required
        value={e.slug}
        error={errors.slug}
        autoCapitalize="none"
        helper={`Used in /events/${e.slug || '{slug}'}`}
        onChange={(v) => {
          setSlugTouched(true);
          set({ slug: v.toLowerCase().replace(/\s+/g, '-') });
        }}
      />
      <TextField label="Description" required multiline value={e.description} error={errors.description} onChange={(v) => set({ description: v })} />
      <Select label="Level" required value={e.level} options={opts(meta.levels.length ? meta.levels : ['Beginner'])} onChange={(v) => set({ level: v })} error={errors.level} />
      <Select
        label="Status"
        required
        value={e.status}
        onChange={(v) => set({ status: v })}
        options={[
          { value: 'published', label: 'Published' },
          { value: 'draft', label: 'Draft' },
          { value: 'ended', label: 'Ended' },
          { value: 'archived', label: 'Archived' },
          { value: 'cancelled', label: 'Cancelled' },
        ]}
      />
    </Card>
  );
}

export function ScheduleStep({ e, set, errors }: StepProps) {
  const dates = e.dates;
  return (
    <>
      <Card>
        <Row>
          <Button title="Add Single Date" variant="secondary" small onPress={() => set({ dates: [...dates, blankEventDate('single')] })} />
          <Button title="Add Date Range" variant="secondary" small onPress={() => set({ dates: [...dates, blankEventDate('range')] })} />
        </Row>
        {errors.dates ? <Txt style={{ color: '#C62828', marginTop: 8 }}>{errors.dates}</Txt> : null}
      </Card>
      <RepeatList
        items={dates}
        onChange={(d) => set({ dates: d })}
        make={() => blankEventDate('single')}
        addLabel="Add another date"
        title={(_, i) => `Date Entry ${i + 1}`}
        render={(d, up, i) => (
          <View>
            <Select
              label="Type"
              value={d.type}
              onChange={(v) => up({ type: v, endDate: v === 'range' ? (d.endDate ?? '') : null })}
              options={[
                { value: 'single', label: 'Single Date' },
                { value: 'range', label: 'Date Range' },
              ]}
            />
            <TextField label="Label" optional value={d.label} onChange={(v) => up({ label: v })} placeholder="Part 1 - Foundations, Day 1…" />
            <NumberField label="Max Registrations" optional value={d.maxRegistrations} onChange={(v) => up({ maxRegistrations: v })} helper="Empty = event capacity" />
            <NumberField label="Session price override" optional value={d.sessionPrice} onChange={(v) => up({ sessionPrice: v })} helper="Empty = inherits the event price" />
            <DateField label={d.type === 'range' ? 'Start date' : 'Date'} required value={d.date} onChange={(v) => up({ date: v })} error={errors[`dates.${i}.date`]} />
            {d.type === 'range' ? <DateField label="End date" required value={d.endDate} onChange={(v) => up({ endDate: v })} error={errors[`dates.${i}.endDate`]} /> : null}
            <Row>
              <View style={{ flex: 1 }}>
                <DateField mode="time" label="Start Time" required value={d.startTime} onChange={(v) => up({ startTime: v })} clearable={false} error={errors[`dates.${i}.startTime`]} />
              </View>
              <View style={{ flex: 1 }}>
                <DateField mode="time" label="End Time" value={d.endTime} onChange={(v) => up({ endTime: v })} />
              </View>
            </Row>
            <TextField label="Location" value={d.location} onChange={(v) => up({ location: v })} placeholder="City, Country" />
            <TextField label="Venue" value={d.venue} onChange={(v) => up({ venue: v })} />
            <TextField label="Venue Address" value={d.venueAddress} onChange={(v) => up({ venueAddress: v })} />
            <TextField label="Internal Notes" optional multiline value={d.internalNotes} onChange={(v) => up({ internalNotes: v })} helper="Not public" />
          </View>
        )}
      />
      <Card>
        <Select label="Timezone" value={e.timezone} options={opts(TIMEZONES)} onChange={(v) => set({ timezone: v })} helper="Registration close times and reminders use it too." />
        <SectionTitle title="Event Timeline" />
        {dates.length === 0 ? <Txt v="muted">No dates yet.</Txt> : null}
        {[...dates]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((d) => (
            <Txt key={d.id} v="small" style={{ paddingVertical: 3 }}>
              • {d.date ? dateEntryLabel(d) : 'Date not set'}
            </Txt>
          ))}
      </Card>
    </>
  );
}

function SpeakerFields({ s, up, errors, prefix }: { s: Speaker; up: (p: Partial<Speaker>) => void; errors: Record<string, string>; prefix: string }) {
  return (
    <View>
      <TextField label="Name" value={s.name} onChange={(v) => up({ name: v })} />
      <TextField label="Title" value={s.title} onChange={(v) => up({ title: v })} />
      <TextField label="Bio" multiline value={s.bio} onChange={(v) => up({ bio: v })} />
      <TextField label="Company" value={s.company} onChange={(v) => up({ company: v })} />
      <TextField label="LinkedIn Profile" value={s.linkedin} onChange={(v) => up({ linkedin: v })} autoCapitalize="none" placeholder="https://www.linkedin.com/in/" error={errors[`${prefix}.linkedin`]} />
      <ImageList label="Photo" multiple={false} uris={s.photoUrl ? [s.photoUrl] : []} onChange={(u) => up({ photoUrl: u[0] ?? '' })} />
    </View>
  );
}

export function InstructorStep({ e, set, errors }: StepProps) {
  const hp = e.hostingPartner;
  const setHp = (p: Partial<typeof hp>) => set({ hostingPartner: { ...hp, ...p } });
  return (
    <>
      <Card>
        <SectionTitle title="Instructor" />
        <SpeakerFields s={e.instructor} up={(p) => set({ instructor: { ...e.instructor, ...p } })} errors={errors} prefix="instructor" />
      </Card>
      <Card>
        <SectionTitle title="Hosting partner" />
        <TextField label="Partner name" optional value={hp.name} onChange={(v) => setHp({ name: v })} placeholder="e.g. a business school" />
        <TextField label="How the partner is introduced" value={hp.intro} onChange={(v) => setHp({ intro: v })} />
        <TextField label="Website" optional value={hp.website} onChange={(v) => setHp({ website: v })} autoCapitalize="none" />
        <ImageList label="Logo" multiple={false} uris={hp.logoUrl ? [hp.logoUrl] : []} onChange={(u) => setHp({ logoUrl: u[0] ?? '' })} />
        <ImageList label="Logo (second variant)" multiple={false} uris={hp.logoAltUrl ? [hp.logoAltUrl] : []} onChange={(u) => setHp({ logoAltUrl: u[0] ?? '' })} />
        <TextField label="Brand colour" optional value={hp.brandColour} onChange={(v) => setHp({ brandColour: v })} placeholder="#BB141B" autoCapitalize="none" />
      </Card>
      <Card>
        <SectionTitle title="Other speakers" />
        <RepeatList
          items={e.otherSpeakers}
          onChange={(v) => set({ otherSpeakers: v })}
          make={blankSpeaker}
          addLabel="Add speaker"
          title={(s, i) => s.name || `Speaker ${i + 1}`}
          render={(s, up, i) => <SpeakerFields s={s} up={up} errors={errors} prefix={`otherSpeakers.${i}`} />}
        />
      </Card>
    </>
  );
}

export function DetailsStep({ e, set, errors, meta }: StepProps) {
  return (
    <Card>
      <ChipInput label="Prerequisites" values={e.prerequisites} onChange={(v) => set({ prerequisites: v })} suggestions={meta.prerequisites} max={10} helper={errors.prerequisites} />
      <ChipInput label="What's Included" values={e.included} onChange={(v) => set({ included: v })} suggestions={meta.included} max={15} helper={errors.included} />
      <ChipInput label="What Customers Will Gain" values={e.gains} onChange={(v) => set({ gains: v })} suggestions={meta.gains} max={15} helper={errors.gains} />
    </Card>
  );
}

export function PageStep({ e, set }: StepProps) {
  const pc = e.pageContent;
  const setPc = (p: Partial<typeof pc>) => set({ pageContent: { ...pc, ...p } });
  return (
    <>
      <SimNote text="Everything here is optional. Sections only appear on the event page when they have content." />
      <Card>
        <TextField label="About the Event" multiline value={pc.about} onChange={(v) => setPc({ about: v })} helper="Blank line = new paragraph" />
        <StringList label="What Attendees Walk Away With" items={pc.outcomes} onChange={(v) => setPc({ outcomes: v })} addLabel="Add outcome" />
      </Card>
      <Card>
        <SectionTitle title="Who It's For" />
        <RepeatList
          items={pc.audiences}
          onChange={(v) => setPc({ audiences: v })}
          make={() => ({ group: '', line: '' })}
          addLabel="Add audience"
          title={(a, i) => a.group || `Audience ${i + 1}`}
          render={(a, up) => (
            <>
              <TextField label="Group name" value={a.group} onChange={(v) => up({ group: v })} />
              <TextField label="One line" value={a.line} onChange={(v) => up({ line: v })} />
            </>
          )}
        />
      </Card>
      <Card>
        <SectionTitle title="Agenda" />
        <RepeatList
          items={pc.agenda}
          onChange={(v) => setPc({ agenda: v })}
          make={() => ({ start: '09:00', end: '10:30', title: '', description: '', quiet: false })}
          addLabel="Add agenda item"
          title={(a) => `${a.start}–${a.end} ${a.title}`}
          render={(a, up) => (
            <>
              <Row>
                <View style={{ flex: 1 }}>
                  <DateField mode="time" label="Start" value={a.start} onChange={(v) => up({ start: v })} clearable={false} />
                </View>
                <View style={{ flex: 1 }}>
                  <DateField mode="time" label="End" value={a.end} onChange={(v) => up({ end: v })} clearable={false} />
                </View>
              </Row>
              <TextField label="Title" value={a.title} onChange={(v) => up({ title: v })} />
              <TextField label="Description" multiline value={a.description} onChange={(v) => up({ description: v })} />
              <Checkbox label="Quiet row" helper="For arrival, breaks or lunch" checked={a.quiet} onChange={(v) => up({ quiet: v })} />
            </>
          )}
        />
      </Card>
      <Card>
        <SectionTitle title="Frequently Asked Questions" />
        <RepeatList
          items={pc.faqs}
          onChange={(v) => setPc({ faqs: v })}
          make={() => ({ q: '', a: '' })}
          addLabel="Add question"
          title={(f, i) => f.q || `Question ${i + 1}`}
          render={(f, up) => (
            <>
              <TextField label="Question" value={f.q} onChange={(v) => up({ q: v })} />
              <TextField label="Answer" multiline value={f.a} onChange={(v) => up({ a: v })} />
            </>
          )}
        />
      </Card>
      <Card>
        <SectionTitle title="Extra Sections" />
        <RepeatList
          items={pc.extraSections}
          onChange={(v) => setPc({ extraSections: v })}
          make={() => ({ title: '', text: '' })}
          addLabel="Add section"
          title={(s, i) => s.title || `Section ${i + 1}`}
          render={(s, up) => (
            <>
              <TextField label="Title" value={s.title} onChange={(v) => up({ title: v })} />
              <TextField label="Text" multiline value={s.text} onChange={(v) => up({ text: v })} />
            </>
          )}
        />
      </Card>
    </>
  );
}

export function PricingStep({ e, set, errors }: StepProps) {
  return (
    <Card>
      <NumberField label="Price" value={e.price} onChange={(v) => set({ price: v ?? 0 })} helper="0.00 = free" error={errors.price} />
      <RadioGroup
        label="Currency"
        value={e.currency}
        onChange={(v) => set({ currency: v })}
        options={[
          { value: 'GHS', label: 'GHS (₵)' },
          { value: 'USD', label: 'USD ($)' },
        ]}
      />
      <NumberField label="Capacity" value={e.capacity} onChange={(v) => set({ capacity: v ?? 0 })} error={errors.capacity} />
      <Checkbox label="Show seat count publicly" checked={e.showSeatCount} onChange={(v) => set({ showSeatCount: v })} />
    </Card>
  );
}

export function MediaStep({ e, set, errors }: StepProps) {
  const m = e.media;
  const setM = (p: Partial<typeof m>) => set({ media: { ...m, ...p } });
  return (
    <Card>
      <ImageList label="Event Images" uris={m.images} onChange={(v) => setM({ images: v })} />
      <ImageList label="Venue photos" uris={m.venuePhotos} onChange={(v) => setM({ venuePhotos: v })} />
      <TextField label="Promo Video URL" optional value={m.promoVideoUrl} onChange={(v) => setM({ promoVideoUrl: v })} autoCapitalize="none" helper="YouTube or Vimeo" error={errors['media.promoVideoUrl']} />
      <TextField label="Event Brochure URL" optional value={m.brochureUrl} onChange={(v) => setM({ brochureUrl: v })} autoCapitalize="none" helper="PDF" error={errors['media.brochureUrl']} />
      <TextField label="Share Image URL" optional value={m.shareImageUrl} onChange={(v) => setM({ shareImageUrl: v })} autoCapitalize="none" helper="1200×630" error={errors['media.shareImageUrl']} />
    </Card>
  );
}

export function SettingsStep({ e, set }: StepProps) {
  const o = e.options;
  const setO = (p: Partial<typeof o>) => set({ options: { ...o, ...p } });
  const ce = e.confirmationEmail;
  const setCe = (p: Partial<typeof ce>) => set({ confirmationEmail: { ...ce, ...p } });
  return (
    <>
      <Card>
        <SectionTitle title="Event Options" />
        <NumberField label="Priority" value={o.priority} onChange={(v) => setO({ priority: v ?? 0 })} helper="Sort order" />
        <Checkbox label="Featured Event" helper="Shown on the homepage" checked={o.featured} onChange={(v) => setO({ featured: v })} />
        <Checkbox label="Certificate Provided" checked={o.certificate} onChange={(v) => setO({ certificate: v })} />
        <Checkbox label="Allow Discount Codes" checked={o.allowDiscounts} onChange={(v) => setO({ allowDiscounts: v })} />
        <Checkbox label="Allow Pay Later" helper="Paid events only" checked={o.allowPayLater} disabled={e.price === 0} onChange={(v) => setO({ allowPayLater: v })} />
      </Card>
      <Card>
        <SectionTitle title="Confirmation Email" />
        <TextField label="Email Title" value={ce.title} onChange={(v) => setCe({ title: v })} />
        <TextField label="Email Subtitle" value={ce.subtitle} onChange={(v) => setCe({ subtitle: v })} />
        <TextField label="Custom Message" multiline value={ce.message} onChange={(v) => setCe({ message: v })} />
      </Card>
      <Card>
        <SectionTitle title="Role Field Configuration" />
        <Select
          label="Role Input Mode"
          value={e.roleInputMode}
          onChange={(v) => set({ roleInputMode: v })}
          options={[
            { value: 'free_text', label: 'Free Text (default)' },
            { value: 'dropdown', label: 'Dropdown Only' },
            { value: 'dropdown_other', label: 'Dropdown + Free Text ("Other")' },
          ]}
        />
        {e.roleInputMode !== 'free_text' ? <ChipInput label="Dropdown options" values={e.roleOptions} onChange={(v) => set({ roleOptions: v })} /> : null}
      </Card>
    </>
  );
}

export function BookingStep({ e, set }: StepProps) {
  const mc = e.managedCheckout;
  const setMc = (p: Partial<typeof mc>) => set({ managedCheckout: { ...mc, ...p } });
  return (
    <>
      <Card>
        <SwitchRow
          label="Take bookings through the managed checkout"
          helper="One order for each booking and a place for every attendee. People pay by card or mobile money, or ask for a company invoice that holds their places. When off, the event keeps its legacy booking form; settings are kept for later."
          value={mc.enabled}
          onChange={(v) => setMc({ enabled: v })}
        />
      </Card>
      {mc.enabled ? (
        <>
          <Card>
            <SectionTitle title="Event page › Navigation bar" />
            <RadioGroup
              value={mc.navBar}
              onChange={(v) => setMc({ navBar: v })}
              options={[
                { value: 'minimal', label: 'Minimal bar', sub: 'Logo + section links + booking button' },
                { value: 'site', label: 'Site menu' },
                { value: 'none', label: 'No bar' },
              ]}
            />
          </Card>
          <Card>
            <SectionTitle title="Team bookings and company invoices" />
            <Checkbox label="Allow team bookings" helper="One order, a named place per person, each with their own certificate" checked={mc.allowTeamBookings} onChange={(v) => setMc({ allowTeamBookings: v })} />
            <Checkbox label="Allow company invoices" helper="Holds places until the invoice date, then releases them" checked={mc.allowCompanyInvoices} onChange={(v) => setMc({ allowCompanyInvoices: v })} />
          </Card>
          <Card>
            <SectionTitle title="Closing and places left" />
            <DateField mode="datetime" label="Bookings close" optional value={mc.bookingsCloseAt} onChange={(v) => setMc({ bookingsCloseAt: v })} helper="Empty = end of the registration-deadline day" />
            <NumberField label="Show places left under" optional value={mc.showPlacesLeftUnder} onChange={(v) => setMc({ showPlacesLeftUnder: v })} helper="Empty = 10; 0 = never" />
          </Card>
          <Card>
            <SectionTitle title="Price rules" />
            <NumberField label="Lowest price per place" optional value={mc.lowestPricePerPlace} onChange={(v) => setMc({ lowestPricePerPlace: v })} helper="Floor after discounts" />
            <Txt v="label" style={{ marginBottom: space.sm }}>
              Team rates
            </Txt>
            <RepeatList
              items={mc.teamRates}
              onChange={(v) => setMc({ teamRates: v })}
              make={() => ({ minQty: 3, price: e.price })}
              addLabel="Add team rate"
              title={(r) => `${r.minQty}+ places → ${e.currency} ${r.price}`}
              render={(r, up) => (
                <Row>
                  <View style={{ flex: 1 }}>
                    <NumberField label="Min quantity" value={r.minQty} onChange={(v) => up({ minQty: v ?? 1 })} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <NumberField label="Price per place" value={r.price} onChange={(v) => up({ price: v ?? 0 })} />
                  </View>
                </Row>
              )}
            />
          </Card>
          {/* TODO(spec): custom questions, "The day", what-to-bring and booker notes for managed checkout. */}
        </>
      ) : null}
    </>
  );
}

export function RegistrationStep({ e, set }: StepProps) {
  const rr = e.registrationReview;
  const setRr = (p: Partial<typeof rr>) => set({ registrationReview: { ...rr, ...p } });
  return (
    <>
      <Card>
        <SwitchRow
          label="Review every registration before confirming it"
          helper="Visitors request a seat instead of booking one. You confirm each request (up to capacity), online, on a waitlist, or mark it not eligible, and each decision emails the applicant."
          value={rr.enabled}
          onChange={(v) => setRr({ enabled: v })}
        />
      </Card>
      {rr.enabled ? (
        <Card>
          <SectionTitle title="Attendance" />
          <Checkbox label="Offer online attendance" helper="Unlimited; confirmed online guests get the private joining link" checked={rr.offerOnline} onChange={(v) => setRr({ offerOnline: v })} />
          <Checkbox label="Keep a waitlist when in-person seats are full" checked={rr.keepWaitlist} onChange={(v) => setRr({ keepWaitlist: v })} />
          <NumberField label="Review window (hours)" optional value={rr.reviewWindowHours} onChange={(v) => setRr({ reviewWindowHours: v })} helper='"We confirm within 12 hours"' />
          <Checkbox label="One seat per organisation" helper="Blocks the same name or business email domain" checked={rr.oneSeatPerOrganisation} onChange={(v) => setRr({ oneSeatPerOrganisation: v })} />
          <TextField label="Consent tick box text" optional value={rr.consentText} onChange={(v) => setRr({ consentText: v })} helper="Required box; empty = none" />
          <TextField label="Support email" optional value={rr.supportEmail} onChange={(v) => setRr({ supportEmail: v })} keyboardType="email-address" />
          {/* TODO(spec): role eligibility list, custom questions and form wording editors. */}
        </Card>
      ) : null}
    </>
  );
}

export function SeoStep({ e, set, errors, meta }: StepProps) {
  return (
    <>
      <Card>
        <TextField label="Country" value={e.country} onChange={(v) => set({ country: v })} />
        <TextField label="Registration Link" optional value={e.registrationLink} onChange={(v) => set({ registrationLink: v })} autoCapitalize="none" helper="External URL" error={errors.registrationLink} />
        <TextField label="Registration Button Text" value={e.registrationButtonText} onChange={(v) => set({ registrationButtonText: v })} />
        <DateField label="Registration Deadline" value={e.registrationDeadline} onChange={(v) => set({ registrationDeadline: v })} />
        <ChipInput label="Tags" values={e.tags} onChange={(v) => set({ tags: v })} suggestions={meta.tags} max={10} helper={errors.tags} />
      </Card>
      <Card>
        <SectionTitle title="SEO Settings" />
        <TextField label="Meta Title" value={e.seo.metaTitle} onChange={(v) => set({ seo: { ...e.seo, metaTitle: v } })} maxLength={60} counter error={errors['seo.metaTitle']} />
        <TextField label="Meta Description" multiline value={e.seo.metaDescription} onChange={(v) => set({ seo: { ...e.seo, metaDescription: v } })} helper={`${e.seo.metaDescription.length}/160 characters (aim for about 160)`} />
      </Card>
    </>
  );
}

export const STEP_COMPONENTS: Record<StepKey, (p: StepProps) => ReactNode> = {
  basic: BasicStep,
  schedule: ScheduleStep,
  instructor: InstructorStep,
  details: DetailsStep,
  page: PageStep,
  pricing: PricingStep,
  media: MediaStep,
  settings: SettingsStep,
  booking: BookingStep,
  registration: RegistrationStep,
  seo: SeoStep,
};
