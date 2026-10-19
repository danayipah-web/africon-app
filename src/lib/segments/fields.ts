// Field catalogue for the CRM filter builder (spec §6.2).

export type FieldType =
  | 'text'
  | 'phone'
  | 'enum'
  | 'number'
  | 'date'
  | 'bool'
  | 'tags'
  | 'sources'
  | 'event_booking'
  | 'activity'
  | 'campaign'
  | 'segment';

export interface FieldDef {
  key: string;
  label: string;
  group: string;
  type: FieldType;
  hint?: string;
  options?: { value: string; label: string }[];
  /** For `activity` fields: the contact source that marks the activity. */
  activitySource?: string;
}

export const FIELD_GROUPS = [
  'CONTACT DETAILS',
  'LIFECYCLE AND SALES',
  'SOURCE',
  'ACTIVITY',
  'MESSAGING',
  'CONSENT',
  'SEGMENTS',
] as const;

export const SOURCE_OPTIONS = [
  'Booking',
  'AI Sprints',
  'Survey',
  'Import',
  'Website form',
  'Newsletter',
  'Venue booking',
  'Conference',
  'Consultation',
  'Training proposal',
  'Project brief',
  'Office',
].map((s) => ({ value: s, label: s }));

export const FIELDS: FieldDef[] = [
  { key: 'fullName', label: 'Name', group: 'CONTACT DETAILS', type: 'text' },
  { key: 'email', label: 'Email', group: 'CONTACT DETAILS', type: 'text', hint: 'Use "ends with" for company domains' },
  { key: 'phone', label: 'Phone', group: 'CONTACT DETAILS', type: 'phone', hint: 'Digits compared' },
  { key: 'company', label: 'Company', group: 'CONTACT DETAILS', type: 'text' },
  { key: 'jobTitle', label: 'Job title', group: 'CONTACT DETAILS', type: 'text' },
  { key: 'country', label: 'Country', group: 'CONTACT DETAILS', type: 'text' },
  { key: 'city', label: 'City', group: 'CONTACT DETAILS', type: 'text' },
  { key: 'tags', label: 'Tags', group: 'CONTACT DETAILS', type: 'tags' },
  { key: 'createdAt', label: 'Date added', group: 'CONTACT DETAILS', type: 'date' },

  {
    key: 'lifecycleStage',
    label: 'Lifecycle stage',
    group: 'LIFECYCLE AND SALES',
    type: 'enum',
    options: [
      { value: 'lead', label: 'Lead' },
      { value: 'customer', label: 'Customer' },
    ],
  },
  {
    key: 'leadStatus',
    label: 'Lead status',
    group: 'LIFECYCLE AND SALES',
    type: 'enum',
    options: ['New', 'Contacted', 'Qualified', 'Unqualified'].map((s) => ({ value: s, label: s })),
  },
  { key: 'ownerId', label: 'Owner', group: 'LIFECYCLE AND SALES', type: 'enum', options: [] },
  { key: 'leadScore', label: 'Lead score', group: 'LIFECYCLE AND SALES', type: 'number', hint: '0–100; none = 0' },
  { key: 'totalSpent', label: 'Total spent', group: 'LIFECYCLE AND SALES', type: 'number', hint: 'GHS' },
  { key: 'paidBookingsCount', label: 'Paid bookings', group: 'LIFECYCLE AND SALES', type: 'number' },
  { key: 'customerSince', label: 'Customer since', group: 'LIFECYCLE AND SALES', type: 'date' },
  { key: 'lastPaidBookingAt', label: 'Last paid booking', group: 'LIFECYCLE AND SALES', type: 'date' },
  { key: 'hasRefund', label: 'Has a refund', group: 'LIFECYCLE AND SALES', type: 'bool' },
  {
    key: 'markedCustomerManually',
    label: 'Marked customer (not by a payment)',
    group: 'LIFECYCLE AND SALES',
    type: 'bool',
  },
  { key: 'needsReview', label: 'Needs review', group: 'LIFECYCLE AND SALES', type: 'bool' },

  { key: 'sources', label: 'Source (any)', group: 'SOURCE', type: 'sources', options: SOURCE_OPTIONS },
  { key: 'firstSource', label: 'First source', group: 'SOURCE', type: 'enum', options: SOURCE_OPTIONS },

  { key: 'eventBooking', label: 'Event booking', group: 'ACTIVITY', type: 'event_booking' },
  { key: 'sprintBooking', label: 'AI Sprint booking', group: 'ACTIVITY', type: 'activity', activitySource: 'AI Sprints' },
  { key: 'venueBooking', label: 'Venue booking', group: 'ACTIVITY', type: 'activity', activitySource: 'Venue booking' },
  { key: 'surveyResponse', label: 'Survey response', group: 'ACTIVITY', type: 'activity', activitySource: 'Survey' },
  { key: 'conference', label: 'Conference interest', group: 'ACTIVITY', type: 'activity', activitySource: 'Conference' },
  { key: 'consultation', label: 'Consultation request', group: 'ACTIVITY', type: 'activity', activitySource: 'Consultation' },
  {
    key: 'trainingProposal',
    label: 'Training proposal request',
    group: 'ACTIVITY',
    type: 'activity',
    activitySource: 'Training proposal',
  },
  { key: 'projectBrief', label: 'Project brief', group: 'ACTIVITY', type: 'activity', activitySource: 'Project brief' },
  { key: 'contactForm', label: 'Contact form message', group: 'ACTIVITY', type: 'activity', activitySource: 'Website form' },
  { key: 'newsletter', label: 'Newsletter signup', group: 'ACTIVITY', type: 'activity', activitySource: 'Newsletter' },

  { key: 'campaignSent', label: 'Campaign sent', group: 'MESSAGING', type: 'campaign' },
  { key: 'lastEmailAt', label: 'Last email sent', group: 'MESSAGING', type: 'date' },
  { key: 'lastSmsAt', label: 'Last SMS sent', group: 'MESSAGING', type: 'date' },
  { key: 'emailsSent', label: 'Emails sent', group: 'MESSAGING', type: 'number' },
  { key: 'smsSent', label: 'SMS sent', group: 'MESSAGING', type: 'number' },
  { key: 'lastActivityAt', label: 'Last activity', group: 'MESSAGING', type: 'date' },

  {
    key: 'emailStatus',
    label: 'Email status',
    group: 'CONSENT',
    type: 'enum',
    options: [
      { value: 'can_receive', label: 'Can receive email' },
      { value: 'opted_out', label: 'Unsubscribed' },
      { value: 'no_email', label: 'No email address' },
    ],
  },
  {
    key: 'smsStatus',
    label: 'SMS status',
    group: 'CONSENT',
    type: 'enum',
    options: [
      { value: 'can_receive', label: 'Can receive SMS' },
      { value: 'opted_out', label: 'Unsubscribed' },
      { value: 'no_phone', label: 'No phone number' },
    ],
  },
  { key: 'marketingConsent', label: 'Marketing consent', group: 'CONSENT', type: 'bool' },

  { key: 'segment', label: 'Segment membership', group: 'SEGMENTS', type: 'segment' },
];

export const POPULAR_FIELDS = ['eventBooking', 'sprintBooking', 'lifecycleStage', 'sources', 'tags', 'lastActivityAt'];

export const OPERATORS: Record<FieldType, { value: string; label: string }[]> = {
  text: [
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  phone: [
    { value: 'contains', label: 'contains' },
    { value: 'is', label: 'is' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  enum: [
    { value: 'is', label: 'is any of' },
    { value: 'is_not', label: 'is none of' },
  ],
  number: [
    { value: 'gte', label: 'at least' },
    { value: 'lte', label: 'at most' },
    { value: 'eq', label: 'exactly' },
    { value: 'gt', label: 'more than' },
    { value: 'lt', label: 'less than' },
  ],
  date: [
    { value: 'in_last_days', label: 'in the last (days)' },
    { value: 'not_in_last_days', label: 'not in the last (days)' },
    { value: 'before', label: 'before' },
    { value: 'after', label: 'after' },
    { value: 'is_empty', label: 'never' },
    { value: 'is_not_empty', label: 'ever' },
  ],
  bool: [
    { value: 'is_true', label: 'is yes' },
    { value: 'is_false', label: 'is no' },
  ],
  tags: [
    { value: 'has_any', label: 'has any of' },
    { value: 'has_all', label: 'has all of' },
    { value: 'has_none', label: 'has none of' },
  ],
  sources: [
    { value: 'has_any', label: 'includes any of' },
    { value: 'has_none', label: 'includes none of' },
  ],
  event_booking: [
    { value: 'has_booked', label: 'has booked' },
    { value: 'has_not_booked', label: 'has not booked' },
  ],
  activity: [
    { value: 'has', label: 'has' },
    { value: 'has_not', label: 'has not' },
  ],
  campaign: [
    { value: 'was_sent', label: 'was sent' },
    { value: 'was_not_sent', label: 'was not sent' },
  ],
  segment: [
    { value: 'in', label: 'is in' },
    { value: 'not_in', label: 'is not in' },
  ],
};

export function fieldDef(key: string) {
  return FIELDS.find((f) => f.key === key);
}

/** Values that need no input (operator is complete on its own). */
export const VALUELESS_OPERATORS = new Set([
  'is_empty',
  'is_not_empty',
  'is_true',
  'is_false',
  'has',
  'has_not',
]);
