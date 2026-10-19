// Core entities for the in-scope modules (spec §3). Field names follow the spec.

export type Role = 'admin' | 'content_manager' | 'viewer';
export type Capability = 'finance' | 'refunds';

/** Per-user preferences, edited from My account. */
export interface UserPrefs {
  notifications: {
    newBooking: boolean;
    assignedToMe: boolean;
    paymentFailed: boolean;
    dailyDigest: boolean;
    weeklyReport: boolean;
  };
  /** Which list the Bookings screen opens on. */
  bookingsScope: 'all' | 'mine';
  bookingsPerPage: 10 | 30 | 50 | 100;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  capabilities: Capability[];
  status: 'active' | 'disabled';
  passwordHash: string;
  createdAt: string;
  lastLoginAt: string | null;
  phone: string;
  jobTitle: string;
  bio: string;
  prefs: UserPrefs;
  passwordChangedAt: string | null;
}

export type Money = { amount: number; currency: 'GHS' | 'USD' };

export type LifecycleStage = 'lead' | 'customer';

export interface Contact {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  country: string;
  city: string;
  tags: string[];
  notes: string;
  internalNotes: string;
  lifecycleStage: LifecycleStage;
  leadStatus: string;
  ownerId: string | null;
  leadScore: number;
  totalSpent: Money[];
  paidBookingsCount: number;
  customerSince: string | null;
  lastPaidBookingAt: string | null;
  hasRefund: boolean;
  markedCustomerManually: boolean;
  needsReview: boolean;
  sources: string[];
  firstSource: string;
  emailOptOut: boolean;
  smsOptOut: boolean;
  marketingConsent: boolean;
  emailsSent: number;
  smsSent: number;
  lastEmailAt: string | null;
  lastSmsAt: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactActivity {
  id: string;
  contactId: string;
  type: 'created' | 'booking' | 'payment' | 'lifecycle' | 'email' | 'sms' | 'note' | 'import' | 'merge' | 'payment_advice';
  source: string;
  summary: string;
  amount?: Money;
  /** Event id when the activity relates to an event booking. */
  eventId?: string;
  bookingId?: string;
  at: string;
}

export interface PaymentAdvice {
  id: string;
  contactId: string;
  fileUri: string;
  fileName: string;
  amount: number;
  method: string;
  reference: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy: string | null;
  at: string;
}

/** Filter-builder AST (spec §6.2 build note). */
export interface Condition {
  kind: 'condition';
  id: string;
  field: string;
  operator: string;
  value?: unknown;
}
export interface ConditionGroup {
  kind: 'group';
  id: string;
  op: 'and' | 'or';
  children: (Condition | ConditionGroup)[];
}

export interface Segment {
  id: string;
  name: string;
  description: string;
  type: 'rules' | 'fixed';
  rules: ConditionGroup;
  contactIds: string[];
  updatedAt: string;
}

export type CampaignStatus = 'draft' | 'scheduled' | 'queued' | 'sending' | 'completed' | 'failed';

export interface Campaign {
  id: string;
  name: string;
  channel: 'email' | 'sms';
  audience: {
    segmentIds: string[];
    conditions: ConditionGroup | null;
    excludeSegmentIds: string[];
    contactIds: string[];
    includeOptedOut: boolean;
  };
  audienceLabel: string;
  subject: string;
  fromName: string;
  replyTo: string;
  body: string;
  status: CampaignStatus;
  recipients: number;
  sent: number;
  failed: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export type EventFormat = 'in_person' | 'virtual' | 'hybrid';
export type EventStatus = 'draft' | 'published' | 'ended' | 'archived' | 'cancelled';

export interface EventDate {
  id: string;
  type: 'single' | 'range';
  label: string;
  maxRegistrations: number | null;
  sessionPrice: number | null;
  date: string; // YYYY-MM-DD (single) or start date (range)
  endDate: string | null;
  startTime: string; // HH:MM
  endTime: string;
  location: string;
  venue: string;
  venueAddress: string;
  internalNotes: string;
}

export interface Speaker {
  name: string;
  title: string;
  bio: string;
  company: string;
  linkedin: string;
  photoUrl: string;
}

export interface AgendaItem {
  start: string;
  end: string;
  title: string;
  description: string;
  quiet: boolean;
}

export interface EventItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  format: EventFormat;
  level: string;
  status: EventStatus;
  description: string;
  dates: EventDate[];
  timezone: string;
  instructor: Speaker;
  hostingPartner: { name: string; intro: string; website: string; logoUrl: string; logoAltUrl: string; brandColour: string };
  otherSpeakers: Speaker[];
  prerequisites: string[];
  included: string[];
  gains: string[];
  pageContent: {
    about: string;
    outcomes: string[];
    audiences: { group: string; line: string }[];
    agenda: AgendaItem[];
    faqs: { q: string; a: string }[];
    extraSections: { title: string; text: string }[];
  };
  price: number;
  currency: 'GHS' | 'USD';
  capacity: number;
  showSeatCount: boolean;
  media: { images: string[]; venuePhotos: string[]; promoVideoUrl: string; brochureUrl: string; shareImageUrl: string };
  options: { priority: number; featured: boolean; certificate: boolean; allowDiscounts: boolean; allowPayLater: boolean };
  confirmationEmail: { title: string; subtitle: string; message: string };
  roleInputMode: 'free_text' | 'dropdown' | 'dropdown_other';
  roleOptions: string[];
  managedCheckout: {
    enabled: boolean;
    navBar: 'minimal' | 'site' | 'none';
    allowTeamBookings: boolean;
    allowCompanyInvoices: boolean;
    bookingsCloseAt: string;
    showPlacesLeftUnder: number | null;
    lowestPricePerPlace: number | null;
    teamRates: { minQty: number; price: number }[];
  };
  registrationReview: {
    enabled: boolean;
    offerOnline: boolean;
    keepWaitlist: boolean;
    reviewWindowHours: number | null;
    oneSeatPerOrganisation: boolean;
    consentText: string;
    supportEmail: string;
  };
  country: string;
  registrationLink: string;
  registrationButtonText: string;
  registrationDeadline: string;
  tags: string[];
  seo: { metaTitle: string; metaDescription: string };
  createdAt: string;
  updatedAt: string;
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'waitlist';
export type PaymentStatus =
  | 'not_required'
  | 'pending'
  | 'pay_later'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';
export type PaymentMethod = 'card' | 'bank_transfer' | 'mobile_money' | 'paystack' | 'cash' | 'free';

export interface Booking {
  id: string;
  ref: string;
  eventId: string;
  eventDateId: string | null;
  customer: { fullName: string; email: string; phone: string; occupation: string; company: string; role: string };
  heardAbout: string;
  attendees: number;
  discountCode: string;
  discountLabel: string;
  discountAmount: number;
  amountPaid: number;
  total: number;
  currency: 'GHS' | 'USD';
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  transactionRef: string;
  specialRequirements: string;
  internalNotes: string;
  tags: string[];
  source: string;
  checkedIn: boolean;
  emailsSent: number;
  smsSent: number;
  /** Staff user who owns follow-up on this booking. */
  assignedTo: string | null;
  /** Staff user who entered the booking; null for website bookings. */
  createdBy: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorEmail: string;
  actorRole: Role | 'system';
  action: string;
  /** read actions are hidden by "Show changes only". */
  kind: 'read' | 'write';
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  at: string;
}

export interface DiscountCode {
  code: string;
  label: string;
  type: 'percent' | 'fixed';
  value: number;
  active: boolean;
}

export interface EventMetadata {
  prerequisites: string[];
  tags: string[];
  included: string[];
  gains: string[];
  categories: string[];
  formats: string[];
  levels: string[];
  heardAboutSources: string[];
}
