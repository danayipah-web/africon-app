import { z } from 'zod';

// Server-side style validation shared by forms and repositories.

const email = z.string().trim().email('Enter a valid email address');
const optionalUrl = z
  .string()
  .trim()
  .refine((v) => v === '' || /^https?:\/\//.test(v), 'Must start with http:// or https://');

export const userCreateSchema = z
  .object({
    email,
    displayName: z.string().trim().min(2, 'Display name is required'),
    role: z.enum(['admin', 'content_manager', 'viewer']),
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

export const bookingFormSchema = z.object({
  eventId: z.string().min(1, 'Choose an event'),
  eventDateId: z.string().nullable(),
  fullName: z.string().trim().min(2, 'Full name is required'),
  email,
  phone: z.string().trim(),
  occupation: z.string(),
  company: z.string().trim(),
  role: z.string().trim(),
  heardAbout: z.string().min(1, 'Tell us how they heard about this'),
  discountCode: z.string().trim(),
  attendees: z.coerce.number().int().min(1, 'At least 1 attendee').max(500),
  amountPaid: z.coerce.number().min(0).nullable(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'no_show', 'waitlist']),
  paymentStatus: z.enum([
    'not_required',
    'pending',
    'pay_later',
    'processing',
    'completed',
    'failed',
    'refunded',
    'partially_refunded',
  ]),
  paymentMethod: z.enum(['card', 'bank_transfer', 'mobile_money', 'paystack', 'cash', 'free']),
  transactionRef: z.string().trim(),
  specialRequirements: z.string(),
  internalNotes: z.string(),
  tags: z.array(z.string()),
});
export type BookingForm = z.infer<typeof bookingFormSchema>;

/** Per-step validation for the event wizard (spec §9.3). */
export const eventStepSchemas = {
  basic: z.object({
    category: z.string().trim().min(1, 'Category is required'),
    format: z.enum(['in_person', 'virtual', 'hybrid']),
    title: z.string().trim().min(3, 'Event title is required'),
    slug: z
      .string()
      .trim()
      .min(1, 'URL slug is required')
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and dashes only'),
    description: z.string().trim().min(1, 'Description is required'),
    level: z.string().min(1, 'Level is required'),
    status: z.enum(['draft', 'published', 'ended', 'archived', 'cancelled']),
  }),
  schedule: z.object({
    dates: z
      .array(
        z
          .object({
            type: z.enum(['single', 'range']),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date is required'),
            endDate: z.string().nullable(),
            startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time is required'),
            maxRegistrations: z.number().int().positive().nullable(),
          })
          .refine((d) => d.type === 'single' || (!!d.endDate && d.endDate >= d.date), {
            message: 'End date must be on or after the start date',
            path: ['endDate'],
          }),
      )
      .min(1, 'Add at least one date'),
  }),
  instructor: z.object({ instructor: z.object({ linkedin: optionalUrl }) }),
  details: z.object({
    prerequisites: z.array(z.string()).max(10, 'At most 10 prerequisites'),
    included: z.array(z.string()).max(15, 'At most 15 items'),
    gains: z.array(z.string()).max(15, 'At most 15 items'),
  }),
  pricing: z.object({
    price: z.number().min(0, 'Price cannot be negative'),
    capacity: z.number().int().min(1, 'Capacity must be at least 1'),
  }),
  media: z.object({
    media: z.object({ promoVideoUrl: optionalUrl, brochureUrl: optionalUrl, shareImageUrl: optionalUrl }),
  }),
  seo: z.object({
    tags: z.array(z.string()).max(10, 'At most 10 tags'),
    registrationLink: optionalUrl,
    seo: z.object({ metaTitle: z.string().max(60, 'Meta title is at most 60 characters') }),
  }),
};

export const contactEditSchema = z.object({
  fullName: z.string().trim(),
  email: z.union([z.literal(''), email]),
  phone: z.string().trim(),
});

/** Event-metadata option: trimmed, single line, ≤ 120 chars (spec §12.2 build note). */
export const metadataOptionSchema = z
  .string()
  .trim()
  .min(1, 'Option cannot be empty')
  .max(120, 'At most 120 characters')
  .refine((v) => !/[\r\n]/.test(v), 'One option per line')
  .refine((v) => !/lorem ipsum/i.test(v), 'Placeholder text is not allowed');

/** First zod error message per path, for inline form errors. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    out[key] ??= issue.message;
  }
  return out;
}
