import { Stack } from 'expo-router';

import { rootScreen, useStackOptions } from '@/components/nav';

export default function EventsLayout() {
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={rootScreen('Events & Trainings')} />
      <Stack.Screen name="due" options={{ title: 'Due work' }} />
      <Stack.Screen name="new" options={{ title: 'Create event', headerRight: () => null }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Event' }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Edit event', headerRight: () => null }} />
    </Stack>
  );
}
