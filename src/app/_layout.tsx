import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { restoreSession } from '@/auth/session';
import { ConfirmHost, ToastHost } from '@/components/overlays';
import { Txt } from '@/components/ui';
import { processDueCampaigns } from '@/data/repo/crm';
import { ensureSeeded } from '@/data/repo/settings';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { c, isDark } = useTheme();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await ensureSeeded();
        await restoreSession();
        processDueCampaigns();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        SplashScreen.hideAsync();
      }
    })();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') processDueCampaigns();
    });
    return () => sub.remove();
  }, []);

  const navTheme = isDark ? DarkTheme : DefaultTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
      <ThemeProvider value={{ ...navTheme, colors: { ...navTheme.colors, background: c.bg, card: c.card, text: c.text, border: c.border, primary: c.primary } }}>
        {error ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: c.bg }}>
            <Txt v="h2">Could not start</Txt>
            <Txt v="muted">{error}</Txt>
          </View>
        ) : (
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
            <Stack.Screen name="(admin)" />
            <Stack.Screen name="login" />
          </Stack>
        )}
        <ConfirmHost />
        <ToastHost />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
