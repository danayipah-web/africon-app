import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Hourglass } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout';
import { SOON_LABELS } from '@/components/nav';
import { Button, Card, Txt } from '@/components/ui';
import { space, useTheme } from '@/theme';

export default function ComingSoon() {
  const { c } = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const nav = useNavigation();
  const title = SOON_LABELS[slug ?? ''] ?? 'This module';

  useEffect(() => {
    nav.setOptions({ title });
  }, [nav, title]);

  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: space.md, paddingVertical: 40 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Hourglass size={26} color={c.primary} />
        </View>
        <Txt v="h2" style={{ textAlign: 'center' }}>
          {title} is coming soon
        </Txt>
        <Txt v="muted" style={{ textAlign: 'center' }}>
          This part of the admin is not in this test build yet. Bookings, CRM, Users, Events & Trainings and Settings are ready to try.
        </Txt>
        <Button title="Back to dashboard" variant="secondary" onPress={() => router.navigate('/')} />
      </Card>
    </Screen>
  );
}
