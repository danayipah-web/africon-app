import type { LucideIcon } from 'lucide-react-native';
import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { toneFor, type Tone } from '@/lib/labels';
import { fonts, radius, space, useTheme } from '@/theme';

type TxtVariant = 'body' | 'muted' | 'faint' | 'label' | 'small' | 'h1' | 'h2' | 'h3' | 'caps' | 'mono';

export function Txt({
  v = 'body',
  style,
  color,
  ...rest
}: TextProps & { v?: TxtVariant; color?: string; style?: StyleProp<TextStyle> }) {
  const { c } = useTheme();
  const base: Record<TxtVariant, TextStyle> = {
    body: { fontSize: 15, color: c.text },
    muted: { fontSize: 14, color: c.textMuted },
    faint: { fontSize: 12, color: c.textFaint },
    small: { fontSize: 13, color: c.text },
    label: { fontSize: 13, fontWeight: '600', color: c.text },
    h1: { fontSize: 26, fontFamily: fonts.serif, color: c.text, fontWeight: '600' },
    h2: { fontSize: 19, fontFamily: fonts.serif, color: c.text, fontWeight: '600' },
    h3: { fontSize: 16, fontWeight: '700', color: c.text },
    caps: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: c.textMuted, textTransform: 'uppercase' },
    mono: { fontSize: 13, fontFamily: 'monospace', color: c.text },
  };
  return <Text {...rest} style={[base[v], color ? { color } : null, style]} />;
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.lg },
        padded && { padding: space.lg },
        style,
      ]}>
      {children}
    </View>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'dangerGhost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon: Icon,
  disabled,
  loading,
  small,
  style,
  accessibilityHint,
}: {
  title: string;
  onPress?: () => void;
  variant?: BtnVariant;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const { c } = useTheme();
  const palette: Record<BtnVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: c.primary, fg: c.primaryText, border: c.primary },
    secondary: { bg: c.card, fg: c.text, border: c.border },
    danger: { bg: c.danger, fg: '#FFFFFF', border: c.danger },
    ghost: { bg: 'transparent', fg: c.primary, border: 'transparent' },
    dangerGhost: { bg: 'transparent', fg: c.danger, border: 'transparent' },
  };
  const p = palette[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      accessibilityHint={accessibilityHint}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          backgroundColor: p.bg,
          borderColor: p.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: small ? 10 : 16,
          minHeight: small ? 34 : 44,
          opacity: off ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}>
      {loading ? <ActivityIndicator size="small" color={p.fg} /> : Icon ? <Icon size={small ? 15 : 17} color={p.fg} /> : null}
      <Text style={{ color: p.fg, fontWeight: '600', fontSize: small ? 13 : 15 }} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

export function IconButton({
  icon: Icon,
  onPress,
  label,
  color,
  disabled,
  size = 20,
}: {
  icon: LucideIcon;
  onPress?: () => void;
  label: string;
  color?: string;
  disabled?: boolean;
  size?: number;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => ({
        padding: 8,
        borderRadius: radius.sm,
        opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
      })}>
      <Icon size={size} color={color ?? c.textMuted} />
    </Pressable>
  );
}

export function Pill({ label, tone = 'grey', style }: { label: string; tone?: Tone; style?: StyleProp<ViewStyle> }) {
  const { tones } = useTheme();
  const t = tones[tone];
  return (
    <View style={[{ backgroundColor: t.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }, style]}>
      <Text style={{ color: t.fg, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Pill coloured from a raw status value, with a human label. */
export function StatusPill({ value, label }: { value: string; label: string }) {
  return <Pill label={label} tone={toneFor(value)} />;
}

export function Row({ children, gap = space.sm, style, wrap }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth * 2, backgroundColor: c.border, marginVertical: space.md }, style]} />;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16, gap: 6 }}>
      <Txt v="h3" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      {body ? (
        <Txt v="muted" style={{ textAlign: 'center' }}>
          {body}
        </Txt>
      ) : null}
      {action ? <View style={{ marginTop: 10 }}>{action}</View> : null}
    </View>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  style,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <Card style={[{ borderTopWidth: 3, borderTopColor: accent ?? c.primary, gap: 4 }, style]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="caps">{label}</Txt>
        {Icon ? <Icon size={18} color={accent ?? c.primary} /> : null}
      </Row>
      <Txt style={{ fontSize: 24, fontWeight: '700' }}>{value}</Txt>
      {sub ? <Txt v="faint">{sub}</Txt> : null}
    </Card>
  );
}

export function KeyValue({ label, value, children }: { label: string; value?: string | number | null; children?: ReactNode }) {
  return (
    <View style={{ paddingVertical: 6, gap: 2 }}>
      <Txt v="faint">{label}</Txt>
      {children ?? <Txt>{value === null || value === undefined || value === '' ? '—' : String(value)}</Txt>}
    </View>
  );
}

export function SectionTitle({ title, right, sub }: { title: string; right?: ReactNode; sub?: string }) {
  return (
    <View style={{ marginBottom: space.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="h3" style={{ flexShrink: 1 }}>
          {title}
        </Txt>
        {right}
      </Row>
      {sub ? <Txt v="muted">{sub}</Txt> : null}
    </View>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const { c } = useTheme();
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const ini = (parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '');
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: c.primary, fontWeight: '700', fontSize: size * 0.38 }}>{ini.toUpperCase()}</Text>
    </View>
  );
}

/** A note shown when an action is simulated in the test build. */
export function SimNote({ text }: { text: string }) {
  const { tones } = useTheme();
  return (
    <View style={{ backgroundColor: tones.blue.bg, borderRadius: radius.md, padding: space.md }}>
      <Text style={{ color: tones.blue.fg, fontSize: 13 }}>{text}</Text>
    </View>
  );
}
