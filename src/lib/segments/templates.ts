import type { ConditionGroup } from '@/domain/types';
import { newId } from '@/lib/ids';

// "Start from a template" cards on the Segments page (spec §6.4).

export interface SegmentTemplate {
  key: string;
  name: string;
  description: string;
  build: () => ConditionGroup;
}

const g = (children: ConditionGroup['children'], op: 'and' | 'or' = 'and'): ConditionGroup => ({
  kind: 'group',
  id: newId(),
  op,
  children,
});
const c = (field: string, operator: string, value?: unknown) =>
  ({ kind: 'condition', id: newId(), field, operator, value }) as const;

export const SEGMENT_TEMPLATES: SegmentTemplate[] = [
  {
    key: 'unpaid-applicants',
    name: 'Event applicants who have not paid',
    description: 'Booked an event but the payment is still open. Choose the events after starting.',
    build: () => g([c('eventBooking', 'has_booked', { eventIds: [], paymentStatuses: ['pending', 'pay_later'] })]),
  },
  {
    key: 'paying',
    name: 'Paying customers',
    description: 'At least one settled payment.',
    build: () => g([c('paidBookingsCount', 'gte', 1)]),
  },
  {
    key: 'sprints-customers',
    name: 'AI Sprints customers',
    description: 'Paid for at least one AI Sprint.',
    build: () => g([c('sprintBooking', 'has'), c('lifecycleStage', 'is', ['customer'])]),
  },
  {
    key: 'newsletter-email',
    name: 'Newsletter subscribers who can receive email',
    description: 'Subscribed, not unsubscribed or bounced.',
    build: () => g([c('newsletter', 'has'), c('emailStatus', 'is', ['can_receive'])]),
  },
  {
    key: 'idle-leads',
    name: 'Leads with no activity in 90 days',
    description: 'Not booked, asked or messaged in 3 months.',
    build: () => g([c('lifecycleStage', 'is', ['lead']), c('lastActivityAt', 'not_in_last_days', 90)]),
  },
  {
    key: 'not-emailed-30',
    name: 'Not emailed in the last 30 days',
    description: 'Can receive email and never emailed, or last emailed over 30 days ago.',
    build: () => g([c('emailStatus', 'is', ['can_receive']), c('lastEmailAt', 'not_in_last_days', 30)]),
  },
  {
    key: 'repeat',
    name: 'Repeat customers',
    description: 'Two or more paid bookings.',
    build: () => g([c('paidBookingsCount', 'gte', 2)]),
  },
];
