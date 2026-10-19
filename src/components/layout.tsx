import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, useTheme } from '@/theme';
import { Select } from './form';
import { IconButton, Row, Txt } from './ui';

export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: c.bg }, style]}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[{ padding: space.lg, gap: space.lg, paddingBottom: 48 }, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
      {children}
    </ScrollView>
  );
}

/** Serif H1 + one-line description + optional primary action (spec §2.1). */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Txt v="h1" accessibilityRole="header">
        {title}
      </Txt>
      {description ? <Txt v="muted">{description}</Txt> : null}
      {actions ? (
        <Row wrap gap={8} style={{ marginTop: 4 }}>
          {actions}
        </Row>
      ) : null}
    </View>
  );
}

export interface ChipDef<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Quick-filter chips with counts (spec §2.3). */
export function FilterChips<T extends string>({ chips, value, onChange }: { chips: ChipDef<T>[]; value: T; onChange: (v: T) => void }) {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {chips.map((ch) => {
        const on = ch.value === value;
        return (
          <Pressable
            key={ch.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(ch.value)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: on ? c.primary : c.border,
              backgroundColor: on ? c.primary : c.card,
            }}>
            <Text style={{ color: on ? c.primaryText : c.text, fontWeight: '600', fontSize: 13 }}>{ch.label}</Text>
            {ch.count !== undefined ? (
              <Text style={{ color: on ? c.primaryText : c.textMuted, fontSize: 12, opacity: 0.9 }}>{ch.count}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Underlined tab bar used for section tabs and detail sub-tabs. */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { c } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ borderBottomWidth: 1, borderBottomColor: c.border, flexGrow: 0 }}
      contentContainerStyle={{ gap: 4 }}>
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <Pressable
            key={t.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.value)}
            style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: on ? c.primary : 'transparent' }}>
            <Text style={{ color: on ? c.primary : c.textMuted, fontWeight: on ? '700' : '500' }}>{t.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** "Showing X to Y of Z results" + per-page + page numbers with ellipsis + Go to (spec §2.3). */
export function Pager({
  page,
  perPage,
  total,
  onPage,
  onPerPage,
  perPageOptions = [10, 30, 50, 100],
  showGoTo,
}: {
  page: number;
  perPage: number;
  total: number;
  onPage: (p: number) => void;
  onPerPage: (n: number) => void;
  perPageOptions?: number[];
  showGoTo?: boolean;
}) {
  const { c } = useTheme();
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  const nums = pageNumbers(page, pages);
  return (
    <View style={{ gap: space.sm, paddingTop: space.sm }}>
      <Row style={{ justifyContent: 'space-between' }} wrap>
        <Txt v="faint">
          Showing {from} to {to} of {total} results
        </Txt>
        <Row gap={6}>
          <Txt v="faint">Per page</Txt>
          <View style={{ width: 84 }}>
            <Select compact value={String(perPage)} options={perPageOptions.map((n) => ({ value: String(n), label: String(n) }))} onChange={(v) => onPerPage(Number(v))} />
          </View>
        </Row>
      </Row>
      <Row style={{ justifyContent: 'center' }} gap={2} wrap>
        <IconButton icon={ChevronLeft} label="Previous page" disabled={page <= 1} onPress={() => onPage(page - 1)} />
        {nums.map((n, i) =>
          n === -1 ? (
            <Txt key={`e${i}`} v="faint" style={{ paddingHorizontal: 4 }}>
              …
            </Txt>
          ) : (
            <Pressable
              key={n}
              onPress={() => onPage(n)}
              accessibilityLabel={`Page ${n}`}
              style={{ minWidth: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: n === page ? c.primary : 'transparent' }}>
              <Text style={{ color: n === page ? c.primaryText : c.text, fontWeight: '600' }}>{n}</Text>
            </Pressable>
          ),
        )}
        <IconButton icon={ChevronRight} label="Next page" disabled={page >= pages} onPress={() => onPage(page + 1)} />
      </Row>
      {showGoTo && pages > 5 ? (
        <Row style={{ justifyContent: 'center' }}>
          <Txt v="faint">Go to</Txt>
          <TextInput
            keyboardType="number-pad"
            placeholder={String(page)}
            placeholderTextColor={c.textFaint}
            onSubmitEditing={(e) => {
              const n = Number(e.nativeEvent.text);
              if (n >= 1 && n <= pages) onPage(n);
            }}
            style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, width: 60, height: 36, textAlign: 'center', color: c.text }}
            accessibilityLabel="Go to page"
          />
        </Row>
      ) : null}
    </View>
  );
}

export function pageNumbers(page: number, pages: number): number[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: number[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);
  if (start > 2) out.push(-1);
  for (let i = start; i <= end; i++) out.push(i);
  if (end < pages - 1) out.push(-1);
  out.push(pages);
  return out;
}

export function paginate<T>(rows: T[], page: number, perPage: number) {
  return rows.slice((page - 1) * perPage, page * perPage);
}

/** Tappable list row card. */
export function ListRow({ children, onPress, selected, style }: { children: ReactNode; onPress?: () => void; selected?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: selected ? c.primarySoft : pressed ? c.cardAlt : c.card,
          borderColor: selected ? c.primary : c.border,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: space.md,
          gap: 6,
        },
        style,
      ]}>
      {children}
    </Pressable>
  );
}
