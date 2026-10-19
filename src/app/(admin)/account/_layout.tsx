import { Stack } from 'expo-router';

import { rootScreen, useStackOptions } from '@/components/nav';

export default function AccountLayout() {
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={rootScreen('My account')} />
      <Stack.Screen name="bookings" options={{ title: 'My bookings' }} />
      <Stack.Screen name="edit" options={{ title: 'Edit profile', headerRight: () => null }} />
      <Stack.Screen name="security" options={{ title: 'Login & security' }} />
      <Stack.Screen name="preferences" options={{ title: 'Preferences' }} />
      <Stack.Screen name="activity" options={{ title: 'My activity' }} />
    </Stack>
  );
}
