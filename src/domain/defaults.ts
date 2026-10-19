import type { EventDate, EventItem, Speaker, UserPrefs } from '@/domain/types';
import { newId } from '@/lib/ids';

export const defaultPrefs = (): UserPrefs => ({
  notifications: { newBooking: true, assignedToMe: true, paymentFailed: true, dailyDigest: false, weeklyReport: true },
  bookingsScope: 'all',
  bookingsPerPage: 30,
});

/** Profile fields added in db v3; spread into every new user. */
export const blankProfile = () => ({ phone: '', jobTitle: '', bio: '', prefs: defaultPrefs(), passwordChangedAt: null });

export const blankSpeaker = (): Speaker => ({ name: '', title: '', bio: '', company: '', linkedin: '', photoUrl: '' });

export const blankEventDate = (type: EventDate['type'] = 'single'): EventDate => ({
  id: newId(),
  type,
  label: '',
  maxRegistrations: null,
  sessionPrice: null,
  date: '',
  endDate: type === 'range' ? '' : null,
  startTime: '09:00',
  endTime: '16:00',
  location: 'Accra, Ghana',
  venue: '',
  venueAddress: '',
  internalNotes: '',
});

export function blankEvent(now = new Date().toISOString()): EventItem {
  return {
    id: newId(),
    slug: '',
    title: '',
    category: '',
    format: 'in_person',
    level: 'Beginner',
    status: 'draft',
    description: '',
    dates: [],
    timezone: 'Ghana time (GMT)',
    instructor: blankSpeaker(),
    hostingPartner: { name: '', intro: 'In partnership with', website: '', logoUrl: '', logoAltUrl: '', brandColour: '' },
    otherSpeakers: [],
    prerequisites: [],
    included: [],
    gains: [],
    pageContent: { about: '', outcomes: [], audiences: [], agenda: [], faqs: [], extraSections: [] },
    price: 0,
    currency: 'GHS',
    capacity: 50,
    showSeatCount: true,
    media: { images: [], venuePhotos: [], promoVideoUrl: '', brochureUrl: '', shareImageUrl: '' },
    options: { priority: 0, featured: false, certificate: false, allowDiscounts: true, allowPayLater: false },
    confirmationEmail: { title: 'Booking Confirmed', subtitle: '', message: '' },
    roleInputMode: 'free_text',
    roleOptions: [],
    managedCheckout: {
      enabled: false,
      navBar: 'minimal',
      allowTeamBookings: false,
      allowCompanyInvoices: false,
      bookingsCloseAt: '',
      showPlacesLeftUnder: null,
      lowestPricePerPlace: null,
      teamRates: [],
    },
    registrationReview: {
      enabled: false,
      offerOnline: false,
      keepWaitlist: false,
      reviewWindowHours: null,
      oneSeatPerOrganisation: false,
      consentText: '',
      supportEmail: '',
    },
    country: 'Ghana',
    registrationLink: '',
    registrationButtonText: 'Register Now',
    registrationDeadline: '',
    tags: [],
    seo: { metaTitle: '', metaDescription: '' },
    createdAt: now,
    updatedAt: now,
  };
}

/** First date of an event (YYYY-MM-DD) or '' when none. */
export function firstDate(e: Pick<EventItem, 'dates'>) {
  return e.dates.map((d) => d.date).filter(Boolean).sort()[0] ?? '';
}

export function lastDate(e: Pick<EventItem, 'dates'>) {
  return e.dates.map((d) => d.endDate || d.date).filter(Boolean).sort().reverse()[0] ?? '';
}

/** "Title - Mon D, YYYY at HH:MM - HH:MM (format)" used in event pickers. */
export function eventCity(e: Pick<EventItem, 'dates' | 'country'>) {
  return e.dates[0]?.location || e.country;
}
