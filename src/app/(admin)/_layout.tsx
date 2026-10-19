import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { ActivityIndicator, View } from 'react-native';

import { useCurrentUser, useSession } from '@/auth/session';
import { DrawerContent, HeaderRight } from '@/components/nav';
import { useTheme } from '@/theme';

export default function AdminLayout() {
  const { c } = useTheme();
  const ready = useSession((s) => s.ready);
  const user = useCurrentUser();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }
  // A disabled account loses access on its next render (sessions revoked, spec §7.3).
  if (!user || user.status !== 'active') return <Redirect href="/login" />;

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: { backgroundColor: c.sidebar, width: 290 },
        sceneStyle: { backgroundColor: c.bg },
      }}>
      <Drawer.Screen
        name="index"
        options={{
          headerShown: true,
          title: 'Dashboard',
          headerStyle: { backgroundColor: c.card },
          headerTintColor: c.text,
          headerShadowVisible: false,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Drawer.Screen
        name="search"
        options={{
          headerShown: true,
          title: 'Search',
          headerStyle: { backgroundColor: c.card },
          headerTintColor: c.text,
          headerShadowVisible: false,
        }}
      />
      <Drawer.Screen
        name="soon/[slug]"
        options={{
          headerShown: true,
          title: 'Coming soon',
          headerStyle: { backgroundColor: c.card },
          headerTintColor: c.text,
          headerShadowVisible: false,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Drawer.Screen name="bookings" />
      <Drawer.Screen name="crm" />
      <Drawer.Screen name="users" />
      <Drawer.Screen name="events" />
      <Drawer.Screen name="settings" />
    </Drawer>
  );
}
