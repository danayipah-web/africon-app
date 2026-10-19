import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useCurrentUser } from '@/auth/session';
import { EmptyState } from '@/components/ui';
import { db } from '@/data/db';
import { BookingFormScreen } from '@/features/bookings/BookingForm';
import { can } from '@/lib/rbac';

export default function EditBooking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useCurrentUser();
  const [booking] = useState(() => db.get().bookings.find((b) => b.id === id));
  if (!booking) return <EmptyState title="Booking not found" />;
  if (!can(me, 'write:bookings')) return <EmptyState title="Not allowed" body="Your role can view bookings but not edit them." />;
  return <BookingFormScreen existing={booking} />;
}
