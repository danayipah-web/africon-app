import { X } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { radius, space, useTheme } from '@/theme';
import { Button, IconButton, Row, Txt } from './ui';

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  scroll = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: c.overlay }} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: radius.lg + 4,
            borderTopRightRadius: radius.lg + 4,
            maxHeight: '88%',
            paddingBottom: Math.max(insets.bottom, space.md),
          }}>
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm }}>
            <View style={{ flex: 1 }}>
              <Txt v="h2">{title}</Txt>
              {subtitle ? <Txt v="muted">{subtitle}</Txt> : null}
            </View>
            <IconButton icon={X} label="Close" onPress={onClose} />
          </Row>
          {scroll ? (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
              {children}
            </ScrollView>
          ) : (
            <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm, flexShrink: 1 }}>{children}</View>
          )}
          {footer ? <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ——— Confirm dialog (imperative) ———

interface ConfirmReq {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
}
const useConfirm = create<{ req: ConfirmReq | null }>(() => ({ req: null }));

/** Destructive actions always confirm and name the record (spec §2.3). */
export function confirm(opts: Omit<ConfirmReq, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => useConfirm.setState({ req: { ...opts, resolve } }));
}

export function ConfirmHost() {
  const { c } = useTheme();
  const req = useConfirm((s) => s.req);
  const close = (ok: boolean) => {
    req?.resolve(ok);
    useConfirm.setState({ req: null });
  };
  return (
    <Modal visible={!!req} transparent animationType="fade" onRequestClose={() => close(false)} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: space.xl }}>
        <View style={{ backgroundColor: c.card, borderRadius: radius.lg, padding: space.lg, gap: space.md }} accessibilityRole="alert">
          <Txt v="h2">{req?.title}</Txt>
          <Txt v="muted">{req?.message}</Txt>
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button title="Cancel" variant="secondary" onPress={() => close(false)} />
            <Button title={req?.confirmLabel ?? 'Confirm'} variant={req?.destructive ? 'danger' : 'primary'} onPress={() => close(true)} />
          </Row>
        </View>
      </View>
    </Modal>
  );
}

// ——— Toasts ———

interface ToastMsg {
  id: number;
  text: string;
  kind: 'success' | 'error' | 'info';
}
const useToasts = create<{ list: ToastMsg[] }>(() => ({ list: [] }));
let seq = 0;

export function toast(text: string, kind: ToastMsg['kind'] = 'success') {
  const id = ++seq;
  useToasts.setState((s) => ({ list: [...s.list, { id, text, kind }].slice(-3) }));
  setTimeout(() => useToasts.setState((s) => ({ list: s.list.filter((t) => t.id !== id) })), kind === 'error' ? 5000 : 3000);
}

export function toastError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  // zod errors carry a JSON list of issues as their message
  try {
    const parsed = JSON.parse(msg) as { message: string }[];
    if (Array.isArray(parsed) && parsed[0]?.message) return toast(parsed[0].message, 'error');
  } catch {
    /* plain message */
  }
  toast(msg, 'error');
}

export function ToastHost() {
  const { tones } = useTheme();
  const list = useToasts((s) => s.list);
  const insets = useSafeAreaInsets();
  useEffect(() => undefined, []);
  if (!list.length) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16, gap: 8 }}>
      {list.map((t) => {
        const tone = t.kind === 'error' ? tones.red : t.kind === 'info' ? tones.blue : tones.green;
        return (
          <View
            key={t.id}
            accessibilityLiveRegion="polite"
            style={{ backgroundColor: tone.bg, borderRadius: radius.md, padding: 14, elevation: 4, shadowOpacity: 0.15, shadowRadius: 8 }}>
            <Text style={{ color: tone.fg, fontWeight: '600' }}>{t.text}</Text>
          </View>
        );
      })}
    </View>
  );
}
