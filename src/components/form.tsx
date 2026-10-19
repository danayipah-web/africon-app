import { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Calendar, Check, ChevronDown, Clock, Search, X } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Platform, Pressable, Switch, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { radius, space, useTheme } from '@/theme';
import { Sheet } from './overlays';
import { Button, Row, Txt } from './ui';

export function Field({
  label,
  required,
  optional,
  helper,
  error,
  children,
}: {
  label?: string;
  required?: boolean;
  optional?: boolean;
  helper?: string;
  error?: string;
  children: ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6, marginBottom: space.md }}>
      {label ? (
        <Row gap={6}>
          <Txt v="label">
            {label}
            {required ? <Text style={{ color: c.danger }}> *</Text> : null}
          </Txt>
          {optional ? <Txt v="faint">Optional</Txt> : null}
        </Row>
      ) : null}
      {children}
      {error ? <Txt style={{ color: c.danger, fontSize: 13 }}>{error}</Txt> : helper ? <Txt v="faint">{helper}</Txt> : null}
    </View>
  );
}

function useInputStyle(error?: string, multiline?: boolean) {
  const { c } = useTheme();
  return {
    borderWidth: 1,
    borderColor: error ? c.danger : c.border,
    backgroundColor: c.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: multiline ? 10 : 0,
    minHeight: multiline ? 96 : 46,
    color: c.text,
    fontSize: 15,
    textAlignVertical: multiline ? ('top' as const) : ('center' as const),
  };
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  optional,
  helper,
  error,
  multiline,
  keyboardType,
  secure,
  maxLength,
  counter,
  autoCapitalize,
  editable = true,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
  helper?: string;
  error?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  secure?: boolean;
  maxLength?: number;
  counter?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  editable?: boolean;
}) {
  const { c } = useTheme();
  const style = useInputStyle(error, multiline);
  const help = counter && maxLength ? `${value.length}/${maxLength} characters${helper ? ` · ${helper}` : ''}` : helper;
  return (
    <Field label={label} required={required} optional={optional} helper={help} error={error}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textFaint}
        multiline={multiline}
        keyboardType={keyboardType}
        secureTextEntry={secure}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize ?? (keyboardType === 'email-address' ? 'none' : 'sentences')}
        autoCorrect={keyboardType !== 'email-address'}
        editable={editable}
        accessibilityLabel={label}
        style={[style, !editable && { opacity: 0.6 }]}
      />
    </Field>
  );
}

export function NumberField({
  value,
  onChange,
  ...rest
}: Omit<Parameters<typeof TextField>[0], 'value' | 'onChange' | 'keyboardType'> & {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  // Follow outside changes (e.g. "Use calculated total") without fighting a half-typed "12.".
  const inSync = text === '' ? value == null : Number(text) === value;
  const shown = inSync ? text : value == null ? '' : String(value);
  return (
    <TextField
      {...rest}
      value={shown}
      keyboardType="decimal-pad"
      onChange={(t) => {
        const clean = t.replace(/[^0-9.]/g, '');
        setText(clean);
        onChange(clean === '' ? null : Number(clean));
      }}
    />
  );
}

export interface Option<T extends string = string> {
  value: T;
  label: string;
  sub?: string;
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  required,
  optional,
  helper,
  error,
  searchable,
  disabled,
  compact,
}: {
  label?: string;
  value: T | null | undefined;
  options: Option<T>[];
  onChange: (v: T) => void;
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
  helper?: string;
  error?: string;
  searchable?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const trigger = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? placeholder}
      onPress={disabled ? undefined : () => setOpen(true)}
      style={{
        ...useInputStyle(error),
        minHeight: compact ? 38 : 46,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        opacity: disabled ? 0.5 : 1,
      }}>
      <Text style={{ color: current ? c.text : c.textFaint, fontSize: compact ? 14 : 15, flexShrink: 1 }} numberOfLines={1}>
        {current?.label ?? placeholder}
      </Text>
      <ChevronDown size={18} color={c.textMuted} />
    </Pressable>
  );
  return (
    <>
      {compact && !label ? (
        trigger
      ) : (
        <Field label={label} required={required} optional={optional} helper={helper} error={error}>
          {trigger}
        </Field>
      )}
      <OptionSheet
        open={open}
        title={label ?? placeholder}
        options={options}
        selected={value ? [value] : []}
        searchable={searchable ?? options.length > 8}
        onClose={() => setOpen(false)}
        onPick={(v) => {
          onChange(v as T);
          setOpen(false);
        }}
      />
    </>
  );
}

export function MultiSelect({
  label,
  values,
  options,
  onChange,
  placeholder = 'None selected',
  helper,
  max,
}: {
  label?: string;
  values: string[];
  options: Option[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  helper?: string;
  max?: number;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const shown = values.map((v) => options.find((o) => o.value === v)?.label ?? v);
  return (
    <>
      <Field label={label} helper={helper}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen(true)}
          style={{ ...useInputStyle(), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
          <Text style={{ color: values.length ? c.text : c.textFaint, flexShrink: 1 }} numberOfLines={2}>
            {values.length ? shown.join(', ') : placeholder}
          </Text>
          <ChevronDown size={18} color={c.textMuted} />
        </Pressable>
      </Field>
      <OptionSheet
        open={open}
        multi
        title={label ?? 'Select'}
        options={options}
        selected={values}
        searchable={options.length > 8}
        onClose={() => setOpen(false)}
        onPick={(v) => {
          if (values.includes(v)) onChange(values.filter((x) => x !== v));
          else if (!max || values.length < max) onChange([...values, v]);
        }}
      />
    </>
  );
}

function OptionSheet({
  open,
  title,
  options,
  selected,
  onPick,
  onClose,
  searchable,
  multi,
}: {
  open: boolean;
  title: string;
  options: Option[];
  selected: string[];
  onPick: (v: string) => void;
  onClose: () => void;
  searchable?: boolean;
  multi?: boolean;
}) {
  const { c } = useTheme();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(s)) : options;
  }, [q, options]);
  return (
    <Sheet open={open} onClose={onClose} title={title} footer={multi ? <Button title="Done" onPress={onClose} /> : undefined}>
      {searchable ? <SearchInput value={q} onChange={setQ} placeholder="Search…" /> : null}
      <FlatList
        data={filtered}
        keyExtractor={(o) => o.value}
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: 420 }}
        ListEmptyComponent={<Txt v="muted" style={{ padding: 12 }}>No matches</Txt>}
        renderItem={({ item }) => {
          const on = selected.includes(item.value);
          return (
            <Pressable
              accessibilityRole={multi ? 'checkbox' : 'button'}
              accessibilityState={{ checked: on, selected: on }}
              onPress={() => onPick(item.value)}
              style={({ pressed }) => ({
                paddingVertical: 12,
                paddingHorizontal: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                borderRadius: radius.sm,
                backgroundColor: pressed ? c.cardAlt : 'transparent',
              })}>
              <View style={{ flex: 1 }}>
                <Txt style={on ? { fontWeight: '700', color: c.primary } : undefined}>{item.label}</Txt>
                {item.sub ? <Txt v="faint">{item.sub}</Txt> : null}
              </View>
              {on ? <Check size={18} color={c.primary} /> : null}
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.inputBg,
        borderRadius: radius.md,
        paddingHorizontal: 12,
        minHeight: 44,
        marginBottom: space.sm,
      }}>
      <Search size={17} color={c.textFaint} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textFaint}
        style={{ flex: 1, color: c.text, fontSize: 15, paddingVertical: 8 }}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} accessibilityLabel="Clear search" hitSlop={8}>
          <X size={16} color={c.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Checkbox({ label, checked, onChange, helper, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; helper?: string; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      onPress={disabled ? undefined : () => onChange(!checked)}
      style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, opacity: disabled ? 0.5 : 1, alignItems: 'flex-start' }}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? c.primary : c.textFaint,
          backgroundColor: checked ? c.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}>
        {checked ? <Check size={15} color={c.primaryText} strokeWidth={3} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Txt>{label}</Txt>
        {helper ? <Txt v="faint">{helper}</Txt> : null}
      </View>
    </Pressable>
  );
}

export function RadioGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: (Option<T> & { disabled?: boolean })[];
  onChange: (v: T) => void;
}) {
  const { c } = useTheme();
  return (
    <Field label={label}>
      <View style={{ gap: 2 }} accessibilityRole="radiogroup">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled: o.disabled }}
              onPress={o.disabled ? undefined : () => onChange(o.value)}
              style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, opacity: o.disabled ? 0.45 : 1 }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: 1.5,
                  borderColor: on ? c.primary : c.textFaint,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 1,
                }}>
                {on ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: c.primary }} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Txt>{o.label}</Txt>
                {o.sub ? <Txt v="faint">{o.sub}</Txt> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

export function SwitchRow({ label, value, onChange, helper, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; helper?: string; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      <View style={{ flex: 1 }}>
        <Txt v="label">{label}</Txt>
        {helper ? <Txt v="faint">{helper}</Txt> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: c.primary, false: c.border }}
        thumbColor="#FFFFFF"
        accessibilityLabel={label}
      />
    </View>
  );
}

export function ChipInput({
  label,
  values,
  onChange,
  placeholder = 'Add…',
  suggestions = [],
  max,
  helper,
}: {
  label?: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  max?: number;
  helper?: string;
}) {
  const { c, tones } = useTheme();
  const [draft, setDraft] = useState('');
  const full = !!max && values.length >= max;
  const add = (raw: string) => {
    const v = raw.trim();
    if (!v || full || values.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...values, v]);
    setDraft('');
  };
  const sugg = suggestions
    .filter((s) => !values.includes(s) && (!draft || s.toLowerCase().includes(draft.toLowerCase())))
    .slice(0, 8);
  return (
    <Field label={label} helper={max ? `${values.length}/${max}${helper ? ` · ${helper}` : ''}` : helper}>
      {values.length ? (
        <Row wrap gap={6}>
          {values.map((v) => (
            <Pressable
              key={v}
              onPress={() => onChange(values.filter((x) => x !== v))}
              accessibilityLabel={`Remove ${v}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: tones.blue.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: tones.blue.fg, fontSize: 13 }}>{v}</Text>
              <X size={13} color={tones.blue.fg} />
            </Pressable>
          ))}
        </Row>
      ) : null}
      <Row>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => add(draft)}
          placeholder={full ? 'Limit reached' : placeholder}
          editable={!full}
          placeholderTextColor={c.textFaint}
          style={[useInputStyle(), { flex: 1 }]}
          returnKeyType="done"
          submitBehavior="submit"
          accessibilityLabel={label ?? placeholder}
        />
        <Button title="Add" variant="secondary" onPress={() => add(draft)} disabled={!draft.trim() || full} />
      </Row>
      {sugg.length ? (
        <Row wrap gap={6}>
          {sugg.map((s) => (
            <Pressable key={s} onPress={() => add(s)} style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: c.textMuted, fontSize: 13 }}>+ {s}</Text>
            </Pressable>
          ))}
        </Row>
      ) : null}
    </Field>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Date / time / datetime picker. Values: date "YYYY-MM-DD", time "HH:MM",
 * datetime ISO string (GMT). Uses the native Android dialog.
 */
export function DateField({
  label,
  value,
  onChange,
  mode = 'date',
  required,
  optional,
  helper,
  error,
  clearable = true,
}: {
  label?: string;
  value: string | null;
  onChange: (v: string) => void;
  mode?: 'date' | 'time' | 'datetime';
  required?: boolean;
  optional?: boolean;
  helper?: string;
  error?: string;
  clearable?: boolean;
}) {
  const { c } = useTheme();
  const style = useInputStyle(error);

  const toDate = (): Date => {
    if (!value) return new Date();
    if (mode === 'time') {
      const [h, m] = value.split(':').map(Number);
      const d = new Date();
      d.setHours(h ?? 9, m ?? 0, 0, 0);
      return d;
    }
    const d = new Date(mode === 'date' ? `${value}T12:00:00Z` : value);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const fmt = (d: Date, m: 'date' | 'time') =>
    m === 'date' ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const open = () => {
    if (Platform.OS !== 'android') return;
    const initial = toDate();
    if (mode === 'datetime') {
      // Pick the date, then the time; the result is stored as GMT ISO.
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        onChange: (e: DateTimePickerEvent, d?: Date) => {
          if (e.type !== 'set' || !d) return;
          DateTimePickerAndroid.open({
            value: initial,
            mode: 'time',
            is24Hour: true,
            onChange: (e2: DateTimePickerEvent, t?: Date) => {
              if (e2.type !== 'set' || !t) return;
              const iso = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), t.getHours(), t.getMinutes())).toISOString();
              onChange(iso);
            },
          });
        },
      });
      return;
    }
    DateTimePickerAndroid.open({
      value: initial,
      mode,
      is24Hour: true,
      onChange: (e: DateTimePickerEvent, d?: Date) => {
        if (e.type === 'set' && d) onChange(fmt(d, mode));
      },
    });
  };

  const display = !value
    ? ''
    : mode === 'datetime'
      ? `${value.slice(0, 10)} ${value.slice(11, 16)} GMT`
      : value;
  const Icon = mode === 'time' ? Clock : Calendar;

  if (Platform.OS !== 'android') {
    return (
      <TextField
        label={label}
        value={value ?? ''}
        onChange={onChange}
        placeholder={mode === 'date' ? 'YYYY-MM-DD' : mode === 'time' ? 'HH:MM' : 'YYYY-MM-DDTHH:MM:00Z'}
        required={required}
        optional={optional}
        helper={helper}
        error={error}
      />
    );
  }

  return (
    <Field label={label} required={required} optional={optional} helper={helper} error={error}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? 'Pick a date'}
        onPress={open}
        style={{ ...style, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon size={17} color={c.textMuted} />
        <Text style={{ flex: 1, color: display ? c.text : c.textFaint, fontSize: 15 }}>
          {display || (mode === 'date' ? 'dd/mm/yyyy' : mode === 'time' ? '--:--' : 'Pick date and time')}
        </Text>
        {clearable && value ? (
          <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityLabel="Clear">
            <X size={16} color={c.textMuted} />
          </Pressable>
        ) : null}
      </Pressable>
    </Field>
  );
}
