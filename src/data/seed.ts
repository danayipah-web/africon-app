import { blankEvent, blankEventDate } from '@/domain/defaults';
import type {
  AdminUser,
  AuditLog,
  Booking,
  BookingStatus,
  Campaign,
  Contact,
  ContactActivity,
  EventItem,
  PaymentMethod,
  PaymentStatus,
  Segment,
} from '@/domain/types';
import { act, blankContact, flagPossibleDuplicates, normEmail, normPhone, syncBooking } from '@/lib/crmSync';
import { newBookingRef, newId } from '@/lib/ids';
import { findDiscount, quote } from '@/lib/pricing';
import { slugify } from '@/lib/format';
import { emptyGroup } from '@/lib/segments/evaluate';
import { SEGMENT_TEMPLATES } from '@/lib/segments/templates';
import type { DbState } from './db';

/** Display name used for every demo admin user. */
export const DEMO_USER_NAME = 'Daky';

/** Demo sign-ins for the test build (shown on the login screen). */
export const DEMO_ACCOUNTS = [
  { email: 'admin@africon.ai', password: 'Admin123!', role: 'admin' as const, displayName: DEMO_USER_NAME },
  { email: 'content@africon.ai', password: 'Content123!', role: 'content_manager' as const, displayName: DEMO_USER_NAME },
  { email: 'viewer@africon.ai', password: 'Viewer123!', role: 'viewer' as const, displayName: DEMO_USER_NAME },
];

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  'Kwame', 'Ama', 'Kofi', 'Akosua', 'Yaw', 'Abena', 'Kwesi', 'Esi', 'Kojo', 'Adwoa', 'Kwabena', 'Afua',
  'Nana', 'Efua', 'Selorm', 'Dzifa', 'Eyram', 'Edem', 'Naa', 'Nii', 'Chidi', 'Ngozi', 'Tunde', 'Amara',
  'Wanjiru', 'Otieno', 'Fatima', 'Ibrahim', 'Grace', 'Samuel', 'Joyce', 'Daniel', 'Priscilla', 'Emmanuel',
];
const LAST = [
  'Mensah', 'Asante', 'Owusu', 'Boateng', 'Osei', 'Agyeman', 'Appiah', 'Darko', 'Addo', 'Quaye', 'Tetteh',
  'Annan', 'Ofori', 'Amoah', 'Sarpong', 'Gyamfi', 'Nkrumah', 'Okafor', 'Adeyemi', 'Kamau', 'Ochieng', 'Bello',
];
const COMPANIES = [
  'MTN Ghana', 'Ecobank', 'Stanbic Bank', 'University of Ghana', 'KNUST', 'Ashesi University', 'Vodafone Ghana',
  'GCB Bank', 'Hubtel', 'mPharma', 'Zeepay', 'Ghana Health Service', 'Self-employed', 'Fidelity Bank', 'Kasapreko',
  '',
];
const ROLES = ['Marketing Manager', 'HR Lead', 'Lecturer', 'Software Engineer', 'Founder', 'Analyst', 'Student', 'Director', ''];
const OCCUPATIONS = ['Working professional', 'Business owner', 'Entrepreneur', 'Student', 'Not specified'];
const CITIES = ['Accra', 'Kumasi', 'Takoradi', 'Tema', 'Cape Coast', 'Tamale'];

export const DEFAULT_METADATA: DbState['metadata'] = {
  prerequisites: [
    'Basic computer skills',
    'A laptop with internet access',
    'A Google account',
    'A ChatGPT account (free tier is fine)',
    'Familiarity with spreadsheets',
    'No prior AI experience needed',
  ],
  tags: ['AI', 'ChatGPT', 'Business', 'Productivity', 'Marketing', 'Data', 'Leadership', 'Education', 'Governance'],
  included: [
    'Certificate of completion',
    'Lunch and refreshments',
    'Course workbook',
    'Lifetime access to recordings',
    'Prompt library',
    'Community WhatsApp group',
  ],
  gains: [
    'Use AI tools confidently at work',
    'Write effective prompts',
    'Automate repetitive tasks',
    'Build an AI adoption plan',
    'Understand AI risks and governance',
  ],
  categories: [
    'Master Class Training',
    'AI Workshop',
    'Technical Training',
    'Webinar',
    'Conference',
    'Corporate Training',
  ],
  formats: ['In Person', 'Virtual', 'Hybrid'],
  levels: ['Beginner', 'Intermediate', 'Advanced', 'Executive', 'Professional'],
  heardAboutSources: ['Facebook/Instagram', 'Joy FM', 'AI Club Member', 'Google Ads', 'WhatsApp status', 'Referred by Staff'],
};

interface EventSeed {
  title: string;
  category: string;
  format: EventItem['format'];
  level: string;
  status: EventItem['status'];
  price: number;
  currency?: 'GHS' | 'USD';
  capacity: number;
  dates: { date: string; endDate?: string; start: string; end: string; label?: string; max?: number }[];
  venue: string;
  featured?: boolean;
  bookings: number;
  instructor: string;
}

const EVENT_SEEDS: EventSeed[] = [
  {
    title: 'AI for Business Growth',
    category: 'Master Class Training',
    format: 'in_person',
    level: 'Beginner',
    status: 'ended',
    price: 1900,
    capacity: 60,
    dates: [{ date: '2026-09-12', start: '09:00', end: '16:00' }],
    venue: 'Movenpick Ambassador Hotel',
    bookings: 34,
    instructor: 'Dr. Kwame Owusu',
  },
  {
    title: 'ChatGPT for Professionals',
    category: 'AI Workshop',
    format: 'hybrid',
    level: 'Beginner',
    status: 'published',
    price: 3600,
    capacity: 80,
    dates: [
      { date: '2026-10-24', start: '09:00', end: '16:00', label: 'Part 1 - Foundations', max: 40 },
      { date: '2026-10-31', start: '09:00', end: '16:00', label: 'Part 2 - Applied', max: 40 },
    ],
    venue: 'Africon Training Centre, East Legon',
    featured: true,
    bookings: 38,
    instructor: 'Ama Darko',
  },
  {
    title: 'AI Governance & Ethics for Leaders',
    category: 'Corporate Training',
    format: 'in_person',
    level: 'Executive',
    status: 'published',
    price: 4000,
    capacity: 80,
    dates: [{ date: '2026-11-26', start: '08:00', end: '16:00' }],
    venue: 'Kempinski Hotel Gold Coast City',
    bookings: 12,
    instructor: 'Prof. Esi Annan',
  },
  {
    title: 'Introduction to Generative AI (Free Webinar)',
    category: 'Webinar',
    format: 'virtual',
    level: 'Beginner',
    status: 'published',
    price: 0,
    capacity: 300,
    dates: [{ date: '2026-10-28', start: '18:00', end: '19:30' }],
    venue: 'Zoom',
    bookings: 45,
    instructor: 'Kojo Asante',
  },
  {
    title: 'Data Analysis with AI',
    category: 'Technical Training',
    format: 'in_person',
    level: 'Intermediate',
    status: 'published',
    price: 2500,
    capacity: 30,
    dates: [{ date: '2026-11-07', endDate: '2026-11-08', start: '09:00', end: '15:00', label: 'Weekend bootcamp' }],
    venue: 'Africon Training Centre, East Legon',
    bookings: 14,
    instructor: 'Selorm Tetteh',
  },
  {
    title: 'AI Marketing Masterclass',
    category: 'Master Class Training',
    format: 'in_person',
    level: 'Intermediate',
    status: 'published',
    price: 450,
    currency: 'USD',
    capacity: 40,
    dates: [{ date: '2026-12-05', start: '09:00', end: '17:00' }],
    venue: 'Lancaster Hotel, Kumasi',
    bookings: 6,
    instructor: 'Naa Quaye',
  },
  {
    title: 'Ghana AI Educators Forum',
    category: 'Conference',
    format: 'hybrid',
    level: 'Professional',
    status: 'draft',
    price: 0,
    capacity: 200,
    dates: [{ date: '2027-01-20', start: '09:00', end: '17:00' }],
    venue: 'University of Ghana, Great Hall',
    bookings: 0,
    instructor: 'Dr. Ibrahim Bello',
  },
  {
    title: 'Prompt Engineering Bootcamp',
    category: 'AI Workshop',
    format: 'virtual',
    level: 'Advanced',
    status: 'cancelled',
    price: 1200,
    capacity: 50,
    dates: [{ date: '2026-10-10', start: '10:00', end: '13:00' }],
    venue: 'Zoom',
    bookings: 3,
    instructor: 'Edem Agyeman',
  },
];

export async function buildSeed(hash: (email: string, password: string) => Promise<string>, now = new Date()): Promise<DbState> {
  const rand = mulberry32(20261019);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]!;
  const daysAgo = (d: number) => new Date(now.getTime() - d * 864e5).toISOString();

  // Users
  const users: AdminUser[] = [];
  for (const [i, a] of DEMO_ACCOUNTS.entries()) {
    users.push({
      id: newId(rand),
      email: a.email,
      displayName: a.displayName,
      role: a.role,
      capabilities: a.role === 'admin' ? ['finance', 'refunds'] : [],
      status: 'active',
      passwordHash: await hash(a.email, a.password),
      createdAt: daysAgo(400 - i * 30),
      lastLoginAt: i === 2 ? null : daysAgo(i + 1),
    });
  }
  users.push({
    id: newId(rand),
    email: 'former.staff@africon.ai',
    displayName: DEMO_USER_NAME,
    role: 'content_manager',
    capabilities: [],
    status: 'disabled',
    passwordHash: await hash('former.staff@africon.ai', 'Disabled123!'),
    createdAt: daysAgo(500),
    lastLoginAt: daysAgo(200),
  });

  // Events
  const events: EventItem[] = EVENT_SEEDS.map((s, i) => {
    const e = blankEvent(daysAgo(120 - i * 10));
    e.title = s.title;
    e.slug = slugify(s.title);
    e.category = s.category;
    e.format = s.format;
    e.level = s.level;
    e.status = s.status;
    e.price = s.price;
    e.currency = s.currency ?? 'GHS';
    e.capacity = s.capacity;
    e.description = `${s.title}: a practical, hands-on ${s.category.toLowerCase()} by Africon for teams and individuals who want real results from AI.`;
    e.instructor = { ...e.instructor, name: s.instructor, title: 'Lead facilitator, Africon', company: 'Africon' };
    e.options.featured = !!s.featured;
    e.options.certificate = s.price > 0;
    e.options.allowPayLater = s.price > 0;
    e.prerequisites = ['A laptop with internet access', 'No prior AI experience needed'];
    e.included = s.price > 0 ? ['Certificate of completion', 'Lunch and refreshments'] : ['Lifetime access to recordings'];
    e.gains = ['Use AI tools confidently at work', 'Write effective prompts'];
    e.tags = ['AI', pick(['Business', 'Productivity', 'Marketing', 'Data'])];
    e.pageContent.about = e.description;
    e.pageContent.outcomes = ['A personal prompt library', 'Three automations you can use on Monday'];
    e.registrationDeadline = s.dates[0]!.date;
    e.seo = { metaTitle: s.title.slice(0, 60), metaDescription: e.description.slice(0, 160) };
    e.managedCheckout.enabled = i === 1;
    e.dates = s.dates.map((d) => ({
      ...blankEventDate(d.endDate ? 'range' : 'single'),
      id: newId(rand),
      date: d.date,
      endDate: d.endDate ?? null,
      startTime: d.start,
      endTime: d.end,
      label: d.label ?? '',
      maxRegistrations: d.max ?? null,
      location: s.venue.includes('Kumasi') ? 'Kumasi, Ghana' : s.venue === 'Zoom' ? 'Online' : 'Accra, Ghana',
      venue: s.venue,
    }));
    return e;
  });

  const discounts = [
    { code: 'EARLYBIRD', label: 'Early Bird', type: 'percent' as const, value: 47.22, active: true },
    { code: 'AICLUB', label: 'AI Club Member', type: 'percent' as const, value: 15, active: true },
    { code: 'STAFF50', label: 'Staff referral', type: 'percent' as const, value: 50, active: true },
    { code: 'TEAM500', label: 'Team discount', type: 'fixed' as const, value: 500, active: false },
  ];

  // Bookings (+ CRM contacts via the same sync used by the app)
  const bookings: Booking[] = [];
  let contacts: Contact[] = [];
  let activities: ContactActivity[] = [];
  const refs = new Set<string>();
  const people: { name: string; email: string; phone: string; company: string; role: string }[] = [];
  for (let i = 0; i < 120; i++) {
    const f = pick(FIRST);
    const l = pick(LAST);
    const company = pick(COMPANIES);
    people.push({
      name: `${f} ${l}`,
      email: `${f}.${l}${i}@${company && company !== 'Self-employed' ? slugify(company).replace(/-/g, '') + '.com' : 'gmail.com'}`.toLowerCase(),
      phone: rand() < 0.85 ? `0${pick(['24', '20', '54', '55', '27', '50'])}${String(Math.floor(rand() * 1e7)).padStart(7, '0')}` : '',
      company,
      role: pick(ROLES),
    });
  }

  EVENT_SEEDS.forEach((s, ei) => {
    const ev = events[ei]!;
    for (let k = 0; k < s.bookings; k++) {
      // ~25% of bookers are repeat customers from earlier events
      const p = rand() < 0.25 && k > 0 ? people[Math.floor(rand() * 40)]! : pick(people);
      const date = ev.dates.length > 1 ? pick(ev.dates) : ev.dates[0]!;
      const attendees = rand() < 0.85 ? 1 : 2 + Math.floor(rand() * 3);
      const code = ev.price > 0 && rand() < 0.3 ? pick(['EARLYBIRD', 'AICLUB', 'STAFF50']) : '';
      const q = quote(ev, attendees, date.id, findDiscount(discounts, code));
      const created = daysAgo(Math.floor(rand() * 60) + (ev.status === 'ended' ? 40 : 1));
      let status: BookingStatus;
      let paymentStatus: PaymentStatus;
      let method: PaymentMethod;
      const r = rand();
      if (q.isFree) {
        status = ev.status === 'ended' ? 'completed' : r < 0.9 ? 'confirmed' : 'cancelled';
        paymentStatus = 'not_required';
        method = 'free';
      } else if (ev.status === 'cancelled') {
        status = 'cancelled';
        paymentStatus = 'refunded';
        method = 'paystack';
      } else if (r < 0.6) {
        status = ev.status === 'ended' ? (rand() < 0.9 ? 'completed' : 'no_show') : 'confirmed';
        paymentStatus = 'completed';
        method = pick(['paystack', 'mobile_money', 'card', 'bank_transfer'] as PaymentMethod[]);
      } else if (r < 0.8) {
        status = 'pending';
        paymentStatus = rand() < 0.5 ? 'pending' : 'pay_later';
        method = 'paystack';
      } else if (r < 0.9) {
        status = 'pending';
        paymentStatus = 'failed';
        method = 'card';
      } else {
        status = 'cancelled';
        paymentStatus = rand() < 0.5 ? 'refunded' : 'failed';
        method = 'paystack';
      }
      const ref = newBookingRef(refs, 2026, rand);
      refs.add(ref);
      const b: Booking = {
        id: newId(rand),
        ref,
        eventId: ev.id,
        eventDateId: date.id,
        customer: {
          fullName: p.name,
          email: p.email,
          phone: p.phone,
          occupation: pick(OCCUPATIONS),
          company: p.company,
          role: p.role,
        },
        heardAbout: pick(DEFAULT_METADATA.heardAboutSources),
        attendees,
        discountCode: q.discountAmount > 0 ? code : '',
        discountLabel: q.discountLabel,
        discountAmount: q.discountAmount,
        amountPaid: paymentStatus === 'completed' ? q.total : 0,
        total: q.total,
        currency: ev.currency,
        status,
        paymentStatus,
        paymentMethod: method,
        transactionRef: paymentStatus === 'completed' ? `T${Math.floor(rand() * 1e12)}` : '',
        specialRequirements: rand() < 0.05 ? 'Wheelchair access please' : '',
        internalNotes: '',
        tags: [],
        source: rand() < 0.9 ? 'Website' : 'Office',
        checkedIn: status === 'completed',
        emailsSent: 1 + Math.floor(rand() * 5),
        smsSent: Math.floor(rand() * 2),
        createdAt: created,
      };
      bookings.push(b);
      const forEmail = bookings.filter((x) => normEmail(x.customer.email) === normEmail(b.customer.email));
      const res = syncBooking(contacts, b, ev, forEmail, created);
      contacts = res.created ? [...contacts, res.contact] : contacts.map((c) => (c.id === res.contact.id ? res.contact : c));
      activities = activities.concat(res.activities);
    }
  });

  // A couple of intentional duplicates in bookings (same email, same event)
  const dupSrc = bookings.find((b) => b.eventId === events[1]!.id)!;
  const dupRef = newBookingRef(refs, 2026, rand);
  bookings.push({ ...dupSrc, id: newId(rand), ref: dupRef, createdAt: daysAgo(2), status: 'pending', paymentStatus: 'pending', amountPaid: 0 });

  // Leads from other sources
  const otherSources = ['AI Sprints', 'Survey', 'Newsletter', 'Website form', 'Consultation', 'Import', 'Conference'];
  for (let i = 0; i < 80; i++) {
    const p = people[40 + (i % 80)] ?? pick(people);
    if (contacts.some((c) => normEmail(c.email) === normEmail(p.email))) {
      // existing contact also came through another source
      const c = contacts.find((x) => normEmail(x.email) === normEmail(p.email))!;
      const src = pick(otherSources);
      if (!c.sources.includes(src)) c.sources = [...c.sources, src];
      continue;
    }
    const src = pick(otherSources);
    const created = daysAgo(Math.floor(rand() * 200));
    const isSprintCustomer = src === 'AI Sprints' && rand() < 0.6;
    const amt = isSprintCustomer ? 380 * (1 + Math.floor(rand() * 3)) : 0;
    const c = blankContact(created, {
      fullName: p.name,
      email: rand() < 0.95 ? p.email : '',
      phone: p.phone ? normPhone(p.phone) : '',
      company: p.company,
      jobTitle: p.role,
      city: pick(CITIES),
      country: 'Ghana',
      sources: [src],
      firstSource: src,
      lifecycleStage: isSprintCustomer ? 'customer' : 'lead',
      totalSpent: amt ? [{ amount: amt, currency: 'GHS' }] : [],
      paidBookingsCount: amt ? Math.round(amt / 380) : 0,
      customerSince: amt ? created : null,
      lastPaidBookingAt: amt ? created : null,
      leadScore: Math.floor(rand() * 90),
      marketingConsent: rand() < 0.6,
      emailOptOut: rand() < 0.08,
      smsOptOut: rand() < 0.1,
      lastActivityAt: daysAgo(Math.floor(rand() * 150)),
      tags: rand() < 0.3 ? [pick(['vip', 'corporate', 'student', 'aikasa'])] : [],
    });
    contacts.push(c);
    activities.push(act(c.id, 'created', src, `Contact created via ${src}`, created));
    if (amt) {
      activities.push({
        ...act(c.id, 'payment', 'AI Sprints', `${amt / 380} AI Sprint session${amt > 380 ? 's' : ''}: GHS ${amt.toFixed(2)}`, created),
        amount: { amount: amt, currency: 'GHS' },
      });
    }
  }

  // Booking contacts get cities/countries too
  contacts = contacts.map((c) => ({ ...c, city: c.city || pick(CITIES), country: c.country || 'Ghana' }));

  // Possible duplicate pair for "Needs review"
  const base = contacts[3]!;
  contacts.push(
    blankContact(daysAgo(5), {
      fullName: base.fullName,
      email: base.email.replace('@', '.work@'),
      phone: base.phone,
      sources: ['Website form'],
      firstSource: 'Website form',
    }),
  );
  const dupIds = flagPossibleDuplicates(contacts);
  contacts = contacts.map((c) => ({ ...c, needsReview: dupIds.has(c.id) }));

  // Segments
  const segments: Segment[] = [
    ...['paying', 'repeat', 'idle-leads'].map((k) => {
      const t = SEGMENT_TEMPLATES.find((x) => x.key === k)!;
      return { id: newId(rand), name: t.name, description: t.description, type: 'rules' as const, rules: t.build(), contactIds: [], updatedAt: daysAgo(10) };
    }),
    {
      id: newId(rand),
      name: 'VIP list',
      description: 'Hand-picked for the leadership dinner',
      type: 'fixed',
      rules: emptyGroup(),
      contactIds: contacts.slice(0, 12).map((c) => c.id),
      updatedAt: daysAgo(20),
    },
  ];

  // Campaign history
  const campaigns: Campaign[] = [
    {
      id: newId(rand),
      name: 'October trainings announcement',
      channel: 'email',
      audience: { segmentIds: [segments[0]!.id], conditions: null, excludeSegmentIds: [], contactIds: [], includeOptedOut: false },
      audienceLabel: segments[0]!.name,
      subject: 'New AI trainings this October, {{firstName}}',
      fromName: 'Africon',
      replyTo: 'hello@africon.ai',
      body: 'Hi {{firstName}},\n\nOur October line-up is out.',
      status: 'completed',
      recipients: 64,
      sent: 63,
      failed: 1,
      scheduledAt: null,
      sentAt: daysAgo(14),
      createdAt: daysAgo(15),
    },
    {
      id: newId(rand),
      name: 'Webinar reminder SMS',
      channel: 'sms',
      audience: { segmentIds: [], conditions: null, excludeSegmentIds: [], contactIds: contacts.slice(0, 50).map((c) => c.id), includeOptedOut: false },
      audienceLabel: '50 hand-picked contacts',
      subject: '',
      fromName: 'Africon',
      replyTo: '',
      body: 'Hi {{firstName}}, the free GenAI webinar starts at 6pm. Join: africon.ai/w',
      status: 'completed',
      recipients: 50,
      sent: 44,
      failed: 2,
      scheduledAt: null,
      sentAt: daysAgo(3),
      createdAt: daysAgo(3),
    },
  ];

  const admin = users[0]!;
  const audit: AuditLog[] = [
    { id: newId(rand), actorEmail: admin.email, actorRole: 'admin', action: 'Created event', kind: 'write', entityType: 'event', entityId: events[2]!.id, details: { title: events[2]!.title }, at: daysAgo(30) },
    { id: newId(rand), actorEmail: users[1]!.email, actorRole: 'content_manager', action: 'Updated event', kind: 'write', entityType: 'event', entityId: events[1]!.id, details: { title: events[1]!.title, changed: ['price', 'capacity'] }, at: daysAgo(6) },
    { id: newId(rand), actorEmail: admin.email, actorRole: 'admin', action: 'list bookings', kind: 'read', entityType: 'booking', entityId: '', details: { filters: { status: 'confirmed', event: events[0]!.title }, resultCount: 31 }, at: daysAgo(1) },
    { id: newId(rand), actorEmail: admin.email, actorRole: 'admin', action: 'Sent campaign', kind: 'write', entityType: 'campaign', entityId: campaigns[1]!.id, details: { name: campaigns[1]!.name, recipients: 50 }, at: daysAgo(3) },
  ];

  return {
    seeded: true,
    users,
    events,
    bookings,
    contacts,
    activities,
    paymentAdvice: [],
    segments,
    campaigns,
    audit,
    discounts,
    metadata: DEFAULT_METADATA,
  };
}
