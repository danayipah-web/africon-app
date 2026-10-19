import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, X } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';
import { toastError } from './overlays';
import { TextField } from './form';
import { Button, IconButton, Row, Txt } from './ui';

/** Repeatable list of objects with add / remove / reorder. */
export function RepeatList<T>({
  items,
  onChange,
  render,
  make,
  addLabel,
  title,
  max,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
  make: () => T;
  addLabel: string;
  title?: (item: T, i: number) => string;
  max?: number;
}) {
  const { c } = useTheme();
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  return (
    <View style={{ gap: space.md }}>
      {items.map((it, i) => (
        <View key={i} style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: space.md, backgroundColor: c.cardAlt }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <Txt v="label" style={{ flex: 1 }} numberOfLines={1}>
              {title ? title(it, i) : `#${i + 1}`}
            </Txt>
            <IconButton icon={ArrowUp} label="Move up" size={16} disabled={i === 0} onPress={() => move(i, -1)} />
            <IconButton icon={ArrowDown} label="Move down" size={16} disabled={i === items.length - 1} onPress={() => move(i, 1)} />
            <IconButton icon={Trash2} label="Remove" size={16} color={c.danger} onPress={() => onChange(items.filter((_, k) => k !== i))} />
          </Row>
          {render(it, (patch) => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x))), i)}
        </View>
      ))}
      <Button title={addLabel} icon={Plus} variant="secondary" onPress={() => onChange([...items, make()])} disabled={!!max && items.length >= max} />
    </View>
  );
}

/** Repeatable single-line strings (outcomes, what to bring…). */
export function StringList({ label, items, onChange, addLabel, placeholder }: { label?: string; items: string[]; onChange: (v: string[]) => void; addLabel: string; placeholder?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6, marginBottom: space.md }}>
      {label ? <Txt v="label">{label}</Txt> : null}
      {items.map((s, i) => (
        <Row key={i} gap={4}>
          <View style={{ flex: 1 }}>
            <TextField value={s} placeholder={placeholder} onChange={(v) => onChange(items.map((x, k) => (k === i ? v : x)))} />
          </View>
          <IconButton icon={X} label="Remove" color={c.danger} onPress={() => onChange(items.filter((_, k) => k !== i))} />
        </Row>
      ))}
      <Button title={addLabel} icon={Plus} variant="ghost" small onPress={() => onChange([...items, ''])} style={{ alignSelf: 'flex-start' }} />
    </View>
  );
}

/** Pick images from the device; stores their local URIs (test build has no file storage). */
export function ImageList({ label, uris, onChange, multiple = true, helper }: { label: string; uris: string[]; onChange: (v: string[]) => void; multiple?: boolean; helper?: string }) {
  const { c } = useTheme();
  const pick = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: multiple, quality: 0.8 });
      if (!r.canceled) onChange(multiple ? [...uris, ...r.assets.map((a) => a.uri)] : [r.assets[0]!.uri]);
    } catch (e) {
      toastError(e);
    }
  };
  return (
    <View style={{ gap: 6, marginBottom: space.md }}>
      <Txt v="label">{label}</Txt>
      {helper ? <Txt v="faint">{helper}</Txt> : null}
      <Row wrap gap={8}>
        {uris.map((u, i) => (
          <View key={u + i}>
            <Image source={{ uri: u }} style={{ width: 84, height: 84, borderRadius: radius.md, backgroundColor: c.cardAlt }} contentFit="cover" />
            <Pressable
              onPress={() => onChange(uris.filter((_, k) => k !== i))}
              accessibilityLabel="Remove image"
              style={{ position: 'absolute', top: 4, right: 4, backgroundColor: c.overlay, borderRadius: 12, padding: 3 }}>
              <X size={14} color="#fff" />
            </Pressable>
          </View>
        ))}
        <Pressable
          onPress={pick}
          accessibilityRole="button"
          accessibilityLabel={`Add ${label}`}
          style={{ width: 84, height: 84, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: c.textFaint, alignItems: 'center', justifyContent: 'center' }}>
          <ImagePlus size={22} color={c.textMuted} />
        </Pressable>
      </Row>
    </View>
  );
}
