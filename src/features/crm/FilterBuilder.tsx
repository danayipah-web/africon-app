import { Plus, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { DateField, MultiSelect, SearchInput, Select } from '@/components/form';
import { Sheet } from '@/components/overlays';
import { Button, IconButton, Row, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import type { Condition, ConditionGroup, Contact } from '@/domain/types';
import { newId } from '@/lib/ids';
import { BOOKING_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/labels';
import { emptyGroup, evaluate, newCondition, type EvalContext, type EventBookingValue } from '@/lib/segments/evaluate';
import { FIELD_GROUPS, FIELDS, fieldDef, OPERATORS, POPULAR_FIELDS, VALUELESS_OPERATORS } from '@/lib/segments/fields';
import { radius, space, useTheme } from '@/theme';

type Node = Condition | ConditionGroup;

function mapGroup(g: ConditionGroup, id: string, fn: (n: Node) => Node | null): ConditionGroup {
  const children: Node[] = [];
  for (const ch of g.children) {
    if (ch.id === id) {
      const r = fn(ch);
      if (r) children.push(r);
    } else if (ch.kind === 'group') children.push(mapGroup(ch, id, fn));
    else children.push(ch);
  }
  return { ...g, children };
}

export function countConditions(g: ConditionGroup | null): number {
  if (!g) return 0;
  return g.children.reduce((n, c) => n + (c.kind === 'group' ? countConditions(c) : 1), 0);
}

/** Field picker: searchable, grouped (spec §6.2 "Filter by… e.g. event, country, tag"). */
export function FieldPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (key: string) => void }) {
  const { c } = useTheme();
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  return (
    <Sheet open={open} onClose={onClose} title="Filter by…">
      <SearchInput value={q} onChange={setQ} placeholder="e.g. event, country, tag" />
      <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
        {FIELD_GROUPS.map((g) => {
          const fields = FIELDS.filter((f) => f.group === g && (!s || f.label.toLowerCase().includes(s)));
          if (!fields.length) return null;
          return (
            <View key={g} style={{ marginBottom: space.sm }}>
              <Txt v="caps" style={{ paddingVertical: 6 }}>
                {g}
              </Txt>
              {fields.map((f) => (
                <Pressable
                  key={f.key}
                  onPress={() => {
                    onPick(f.key);
                    setQ('');
                  }}
                  style={({ pressed }) => ({ paddingVertical: 10, paddingHorizontal: 8, borderRadius: radius.sm, backgroundColor: pressed ? c.cardAlt : 'transparent' })}>
                  <Txt>{f.label}</Txt>
                  {f.hint ? <Txt v="faint">{f.hint}</Txt> : null}
                </Pressable>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

function ValueEditor({ cond, onChange }: { cond: Condition; onChange: (value: unknown) => void }) {
  const { c } = useTheme();
  const events = useDb((s) => s.events);
  const segments = useDb((s) => s.segments);
  const campaigns = useDb((s) => s.campaigns);
  const contacts = useDb((s) => s.contacts);
  const users = useDb((s) => s.users);
  const def = fieldDef(cond.field)!;
  const op = cond.operator;
  if (VALUELESS_OPERATORS.has(op)) return null;

  const input = (placeholder: string, numeric = false) => (
    <TextInput
      value={cond.value == null ? '' : String(cond.value)}
      onChangeText={(t) => onChange(numeric ? (t === '' ? '' : Number(t.replace(/[^0-9.]/g, ''))) : t)}
      placeholder={placeholder}
      placeholderTextColor={c.textFaint}
      keyboardType={numeric ? 'decimal-pad' : 'default'}
      autoCapitalize="none"
      style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: 10, minHeight: 42, color: c.text, backgroundColor: c.inputBg }}
    />
  );
  const arr = Array.isArray(cond.value) ? (cond.value as string[]) : [];

  switch (def.type) {
    case 'text':
    case 'phone':
      return input('Value');
    case 'number':
      return input('Number', true);
    case 'date':
      return op === 'in_last_days' || op === 'not_in_last_days' ? input('Days', true) : <DateField value={(cond.value as string) ?? ''} onChange={onChange} />;
    case 'enum': {
      const options =
        def.key === 'ownerId' ? users.map((u) => ({ value: u.id, label: u.displayName })) : (def.options ?? []);
      return <MultiSelect values={arr} options={options} onChange={onChange} />;
    }
    case 'sources':
      return <MultiSelect values={arr} options={def.options ?? []} onChange={onChange} />;
    case 'tags': {
      const tags = Array.from(new Set(contacts.flatMap((x) => x.tags))).sort();
      return <MultiSelect values={arr} options={tags.map((t) => ({ value: t, label: t }))} onChange={onChange} />;
    }
    case 'segment':
      return <MultiSelect values={arr} options={segments.map((s) => ({ value: s.id, label: s.name, sub: s.type === 'fixed' ? 'Fixed list' : 'Rules' }))} onChange={onChange} />;
    case 'campaign':
      return <MultiSelect values={arr} options={campaigns.map((s) => ({ value: s.id, label: s.name, sub: s.channel.toUpperCase() }))} onChange={onChange} />;
    case 'event_booking': {
      const v = (cond.value ?? { eventIds: [] }) as EventBookingValue;
      const up = (p: Partial<EventBookingValue>) => onChange({ ...v, ...p });
      return (
        <View>
          <MultiSelect
            label="Event"
            values={v.eventIds}
            onChange={(ids) => up({ eventIds: ids })}
            placeholder="Any event"
            options={events.map((e) => ({ value: e.id, label: e.title, sub: `${e.dates[0]?.date ?? ''} · ${e.status}` }))}
          />
          <Txt v="faint" style={{ marginBottom: 6 }}>
            Narrow by
          </Txt>
          <MultiSelect label="Payment" values={v.paymentStatuses ?? []} onChange={(x) => up({ paymentStatuses: x })} placeholder="Any payment" options={Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
          <MultiSelect label="Booking status" values={v.bookingStatuses ?? []} onChange={(x) => up({ bookingStatuses: x })} placeholder="Any status" options={Object.entries(BOOKING_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
          <MultiSelect
            label="Attendance"
            values={v.attendance ?? []}
            onChange={(x) => up({ attendance: x as EventBookingValue['attendance'] })}
            placeholder="Any attendance"
            options={[
              { value: 'checked_in', label: 'Attended' },
              { value: 'not_checked_in', label: 'Not attended / not marked' },
            ]}
          />
          <Row>
            <View style={{ flex: 1 }}>
              <DateField label="Booked after" value={v.bookedAfter ?? ''} onChange={(x) => up({ bookedAfter: x || undefined })} />
            </View>
            <View style={{ flex: 1 }}>
              <DateField label="Booked before" value={v.bookedBefore ?? ''} onChange={(x) => up({ bookedBefore: x || undefined })} />
            </View>
          </Row>
          <Txt v="label">Number of times (at least)</Txt>
          <TextInput
            value={v.minTimes ? String(v.minTimes) : ''}
            onChangeText={(t) => up({ minTimes: t ? Number(t.replace(/\D/g, '')) : undefined })}
            keyboardType="number-pad"
            placeholder="1"
            placeholderTextColor={c.textFaint}
            style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: 10, minHeight: 42, color: c.text, marginTop: 6 }}
          />
        </View>
      );
    }
    default:
      return null;
  }
}

function ConditionRow({ cond, update, remove, contacts, ctx }: { cond: Condition; update: (n: Condition) => void; remove: () => void; contacts: Contact[]; ctx: EvalContext }) {
  const { c } = useTheme();
  const def = fieldDef(cond.field);
  const count = useMemo(() => contacts.filter((x) => evaluate(cond, x, ctx)).length, [cond, contacts, ctx]);
  if (!def) return null;
  return (
    <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: space.sm, gap: 6, backgroundColor: c.card }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="label" style={{ flex: 1 }}>
          {def.label}
        </Txt>
        <Txt v="faint">{count} match</Txt>
        <IconButton icon={X} label={`Remove ${def.label}`} onPress={remove} size={16} />
      </Row>
      <Select compact value={cond.operator} options={OPERATORS[def.type]} onChange={(op) => update({ ...cond, operator: op })} />
      <ValueEditor cond={cond} onChange={(value) => update({ ...cond, value })} />
    </View>
  );
}

function GroupBox({
  group,
  root,
  setRoot,
  contacts,
  ctx,
  depth,
}: {
  group: ConditionGroup;
  root: ConditionGroup;
  setRoot: (g: ConditionGroup) => void;
  contacts: Contact[];
  ctx: EvalContext;
  depth: number;
}) {
  const { c } = useTheme();
  const [picker, setPicker] = useState(false);
  const isRoot = group.id === root.id;
  const replaceSelf = (g: ConditionGroup) => (isRoot ? setRoot(g) : setRoot(mapGroup(root, group.id, () => g)));
  const addChild = (n: Node) => replaceSelf({ ...group, children: [...group.children, n] });

  return (
    <View style={[{ gap: space.sm }, depth > 0 && { borderLeftWidth: 3, borderLeftColor: c.primary, paddingLeft: space.sm, paddingVertical: 4 }]}>
      {group.children.length > 1 || depth > 0 ? (
        <Row>
          <Txt v="faint">Match</Txt>
          {(['and', 'or'] as const).map((op) => (
            <Pressable
              key={op}
              onPress={() => replaceSelf({ ...group, op })}
              accessibilityRole="radio"
              accessibilityState={{ checked: group.op === op }}
              style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: group.op === op ? c.primary : c.cardAlt }}>
              <Text style={{ color: group.op === op ? c.primaryText : c.text, fontWeight: '700', fontSize: 12 }}>{op === 'and' ? 'ALL (AND)' : 'ANY (OR)'}</Text>
            </Pressable>
          ))}
          {!isRoot ? <IconButton icon={X} label="Remove group" onPress={() => setRoot(mapGroup(root, group.id, () => null))} size={16} /> : null}
        </Row>
      ) : null}
      {group.children.map((ch, i) => (
        <View key={ch.id} style={{ gap: 4 }}>
          {i > 0 ? (
            <Txt v="caps" style={{ color: c.primary }}>
              {group.op.toUpperCase()}
            </Txt>
          ) : null}
          {ch.kind === 'group' ? (
            <GroupBox group={ch} root={root} setRoot={setRoot} contacts={contacts} ctx={ctx} depth={depth + 1} />
          ) : (
            <ConditionRow
              cond={ch}
              contacts={contacts}
              ctx={ctx}
              update={(n) => setRoot(mapGroup(root, ch.id, () => n))}
              remove={() => setRoot(mapGroup(root, ch.id, () => null))}
            />
          )}
        </View>
      ))}
      <Row wrap>
        <Button small variant="secondary" icon={Plus} title="Add condition" onPress={() => setPicker(true)} />
        {depth < 2 ? <Button small variant="ghost" icon={Plus} title="Add group" onPress={() => addChild({ ...emptyGroup('or'), id: newId() })} /> : null}
      </Row>
      <FieldPicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(k) => {
          setPicker(false);
          addChild(newCondition(k));
        }}
      />
    </View>
  );
}

/** Condition builder shared by Contacts, Segments and Campaign audience (spec §6.2). */
export function FilterBuilder({ value, onChange, contacts, ctx }: { value: ConditionGroup; onChange: (g: ConditionGroup) => void; contacts: Contact[]; ctx: EvalContext }) {
  const { c } = useTheme();
  if (value.children.length === 0) {
    return (
      <View style={{ gap: space.md }}>
        <Txt v="muted">No conditions yet. Everyone in the CRM is included.</Txt>
        <GroupBox group={value} root={value} setRoot={onChange} contacts={contacts} ctx={ctx} depth={0} />
        <Txt v="faint">Popular</Txt>
        <Row wrap gap={6}>
          {POPULAR_FIELDS.map((k) => (
            <Pressable
              key={k}
              onPress={() => onChange({ ...value, children: [...value.children, newCondition(k)] })}
              style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: c.text, fontSize: 13 }}>{fieldDef(k)?.label}</Text>
            </Pressable>
          ))}
        </Row>
      </View>
    );
  }
  return <GroupBox group={value} root={value} setRoot={onChange} contacts={contacts} ctx={ctx} depth={0} />;
}

/** Filters drawer: edits a draft and applies on "Show n contacts". */
export function FilterDrawer({
  open,
  onClose,
  value,
  onApply,
  contacts,
  ctx,
}: {
  open: boolean;
  onClose: () => void;
  value: ConditionGroup;
  onApply: (g: ConditionGroup) => void;
  contacts: Contact[];
  ctx: EvalContext;
}) {
  const [draft, setDraft] = useState(value);
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setDraft(value);
  }
  const n = useMemo(() => contacts.filter((x) => evaluate(draft, x, ctx)).length, [draft, contacts, ctx]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filters"
      subtitle="Narrow your contacts with conditions. Counts update as you build."
      scroll
      footer={
        <Row>
          <Button title="Clear all" variant="ghost" onPress={() => setDraft(emptyGroup())} />
          <View style={{ flex: 1 }} />
          <Button title="Cancel" variant="secondary" onPress={onClose} />
          <Button
            title={`Show ${n}`}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          />
        </Row>
      }>
      <FilterBuilder value={draft} onChange={setDraft} contacts={contacts} ctx={ctx} />
    </Sheet>
  );
}
