import { Stack } from 'expo-router';

import { rootScreen, useStackOptions } from '@/components/nav';

export default function BookingsLayout() {
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={rootScreen('Bookings')} />
      <Stack.Screen name="new" options={{ title: 'New booking', headerRight: () => null }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Booking' }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Edit booking', headerRight: () => null }} />
    </Stack>
  );
}
