import { Stack } from 'expo-router';

import { rootScreen, useStackOptions } from '@/components/nav';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={rootScreen('Settings')} />
      <Stack.Screen name="event-metadata" options={{ title: 'Event metadata' }} />
    </Stack>
  );
}
