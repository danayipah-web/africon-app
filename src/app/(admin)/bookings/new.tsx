import { useCurrentUser } from '@/auth/session';
import { EmptyState } from '@/components/ui';
import { BookingFormScreen } from '@/features/bookings/BookingForm';
import { can } from '@/lib/rbac';

export default function NewBooking() {
  const me = useCurrentUser();
  if (!can(me, 'write:bookings')) return <EmptyState title="Not allowed" body="Your role can view bookings but not create them." />;
  return <BookingFormScreen />;
}
