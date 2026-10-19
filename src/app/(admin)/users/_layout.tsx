import { Stack } from 'expo-router';

import { rootScreen, useStackOptions } from '@/components/nav';

export default function UsersLayout() {
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={rootScreen('Users')} />
      <Stack.Screen name="new" options={{ title: 'Create user' }} />
      <Stack.Screen name="[uid]" options={{ title: 'User' }} />
    </Stack>
  );
}
