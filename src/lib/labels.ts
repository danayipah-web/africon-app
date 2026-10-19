import type { BookingStatus, EventFormat, EventStatus, PaymentMethod, PaymentStatus } from '@/domain/types';

// Human labels for raw enum values (fixes the "No_show" display bug, spec §14.9).

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'No Show',
  waitlist: 'Waitlist',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  not_required: 'Not Required',
  pending: 'Pending',
  pay_later: 'Pay Later',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  refunded: 'Refunded',
  partially_refunded: 'Partially Refunded',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money',
  paystack: 'Paystack',
  cash: 'Cash',
  free: 'Free',
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  ended: 'Ended',
  archived: 'Archived',
  cancelled: 'Cancelled',
};

export const FORMAT_LABELS: Record<EventFormat, string> = {
  in_person: 'In Person',
  virtual: 'Virtual',
  hybrid: 'Hybrid',
};

export type Tone = 'amber' | 'green' | 'red' | 'grey' | 'blue';

export function toneFor(value: string): Tone {
  switch (value) {
    case 'pending':
    case 'pay_later':
    case 'processing':
    case 'waitlist':
    case 'scheduled':
    case 'queued':
    case 'sending':
      return 'amber';
    case 'confirmed':
    case 'completed':
    case 'published':
    case 'active':
    case 'customer':
    case 'approved':
      return 'green';
    case 'cancelled':
    case 'failed':
    case 'refunded':
    case 'partially_refunded':
    case 'no_show':
    case 'disabled':
    case 'rejected':
      return 'red';
    case 'lead':
      return 'blue';
    default:
      return 'grey';
  }
}

export const OCCUPATIONS = [
  'Not specified',
  'Working professional',
  'Business owner',
  'Entrepreneur',
  'Student',
  'Unemployed',
];

export const TIMEZONES = [
  'Ghana time (GMT)',
  'East Africa Time (EAT, GMT+3)',
  'West Africa Time (WAT, GMT+1)',
  'South Africa Standard Time (SAST, GMT+2)',
  'UK time (GMT or BST)',
  'US Eastern Time (ET)',
  'UTC',
];
