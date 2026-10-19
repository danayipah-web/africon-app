import { Stack } from 'expo-router';

import { rootScreen, useStackOptions } from '@/components/nav';

export default function CrmLayout() {
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={rootScreen('CRM')} />
      <Stack.Screen name="[id]" options={{ title: 'Contact details' }} />
      <Stack.Screen name="segments/index" options={{ title: 'Segments' }} />
      <Stack.Screen name="segments/new" options={{ title: 'New segment', headerRight: () => null }} />
      <Stack.Screen name="segments/[id]" options={{ title: 'Segment', headerRight: () => null }} />
      <Stack.Screen name="campaigns" options={{ title: 'Campaigns' }} />
      <Stack.Screen name="import" options={{ title: 'Import contacts' }} />
    </Stack>
  );
}
