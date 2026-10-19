import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signIn, useCurrentUser, useSession } from '@/auth/session';
import { TextField } from '@/components/form';
import { Button, Card, Txt } from '@/components/ui';
import { DEMO_ACCOUNTS } from '@/data/seed';
import { ROLE_LABELS } from '@/lib/rbac';
import { radius, space, useTheme } from '@/theme';

export default function Login() {
  const { c } = useTheme();
  const ready = useSession((s) => s.ready);
  const user = useCurrentUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (ready && user) return <Redirect href="/" />;

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.sidebar }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.xl }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '800', letterSpacing: 4 }}>AFRICON</Text>
            <Text style={{ color: c.sidebarText, letterSpacing: 4, fontWeight: '600' }}>ADMIN</Text>
            <Text style={{ color: c.sidebarText, marginTop: 8 }}>AI for Growth · back office</Text>
          </View>
          <Card style={{ gap: space.sm }}>
            <Txt v="h2">Sign in</Txt>
            <TextField label="Email" value={email} onChange={setEmail} keyboardType="email-address" placeholder="you@africon.ai" />
            <TextField label="Password" value={password} onChange={setPassword} secure placeholder="••••••••" error={error || undefined} />
            <Button title="Sign in" onPress={submit} loading={busy} disabled={!email || !password} />
          </Card>
          <Card style={{ gap: 6 }}>
            <Txt v="caps">Test build · demo accounts</Txt>
            <Txt v="faint">Tap one to fill the form. Data lives only on this device.</Txt>
            {DEMO_ACCOUNTS.map((a) => (
              <Pressable
                key={a.email}
                onPress={() => {
                  setEmail(a.email);
                  setPassword(a.password);
                }}
                style={({ pressed }) => ({ padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.cardAlt : 'transparent' })}>
                <Txt v="label">{ROLE_LABELS[a.role]}</Txt>
                <Txt v="faint">
                  {a.email} · {a.password}
                </Txt>
              </Pressable>
            ))}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
