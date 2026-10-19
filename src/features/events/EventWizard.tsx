import { router, usePreventRemove } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { confirm, toast, toastError } from '@/components/overlays';
import { Button, Row, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import { isSlugTaken, saveEvent } from '@/data/repo/events';
import { eventStepSchemas, fieldErrors } from '@/domain/schemas';
import type { EventItem } from '@/domain/types';
import { radius, space, useTheme } from '@/theme';
import { STEP_COMPONENTS, STEP_SCHEMA, STEPS, type StepKey } from './WizardSteps';

function validate(key: StepKey, e: EventItem, exceptId: string): Record<string, string> {
  const schemaKey = STEP_SCHEMA[key];
  const out: Record<string, string> = {};
  if (schemaKey) {
    const r = eventStepSchemas[schemaKey].safeParse(e);
    if (!r.success) Object.assign(out, fieldErrors(r.error));
  }
  if (key === 'basic' && e.slug && isSlugTaken(e.slug, exceptId)) out.slug = 'This URL slug is already used by another event';
  return out;
}

/** 11-step create/edit wizard (spec §9.3). State is kept across steps; drafts can be saved at any time. */
export function EventWizard({ initial, isNew }: { initial: EventItem; isNew: boolean }) {
  const { c } = useTheme();
  const meta = useDb((s) => s.metadata);
  const [e, setE] = useState<EventItem>(initial);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [dirty, setDirty] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  const key = STEPS[step]!.key;
  const Step = STEP_COMPONENTS[key];

  const set = (patch: Partial<EventItem>) => {
    setDirty(true);
    setE((x) => ({ ...x, ...patch }));
  };

  // Unsaved-changes guard on navigation (spec §2.3).
  const disablePrevention = usePreventRemove(dirty, ({ repeat }) => {
    confirm({ title: 'Discard changes?', message: 'You have unsaved changes to this event.', confirmLabel: 'Discard', destructive: true }).then((ok) => {
      if (ok) {
        setDirty(false);
        repeat();
      }
    });
  });

  const goto = (i: number) => {
    setStep(i);
    setErrors({});
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const next = () => {
    const errs = validate(key, e, e.id);
    if (Object.keys(errs).length && e.status !== 'draft') {
      setErrors(errs);
      toast('Fix the highlighted fields first', 'error');
      return;
    }
    goto(Math.min(STEPS.length - 1, step + 1));
  };

  const save = async (asDraft: boolean) => {
    const toSave = asDraft ? { ...e, status: 'draft' as const } : e;
    if (!asDraft && toSave.status !== 'draft') {
      for (let i = 0; i < STEPS.length; i++) {
        const errs = validate(STEPS[i]!.key, toSave, toSave.id);
        if (Object.keys(errs).length) {
          goto(i);
          setErrors(errs);
          toast(`${STEPS[i]!.label}: ${Object.values(errs)[0]}`, 'error');
          return;
        }
      }
    }
    setBusy(true);
    try {
      const saved = await saveEvent(toSave);
      setDirty(false);
      disablePrevention();
      toast(isNew ? 'Event created' : 'Event saved');
      router.replace(`/events/${saved.id}`);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border }} contentContainerStyle={{ padding: space.sm, gap: 6 }}>
        {STEPS.map((s, i) => {
          const on = i === step;
          return (
            <Pressable
              key={s.key}
              onPress={() => goto(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Step ${i + 1}: ${s.label}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: on ? c.primary : c.cardAlt }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.primaryText : c.border }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: on ? c.primary : c.textMuted }}>{i + 1}</Text>
              </View>
              <Text style={{ color: on ? c.primaryText : c.text, fontWeight: '600', fontSize: 13 }}>{s.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View>
          <Txt v="faint">
            Step {step + 1} of {STEPS.length}
          </Txt>
          <Txt v="h2">{STEPS[step]!.label}</Txt>
          <Txt v="muted">{STEPS[step]!.sub}</Txt>
          <Row gap={4} style={{ marginTop: 8 }}>
            {STEPS.map((s, i) => (
              <View key={s.key} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? c.primary : c.border }} />
            ))}
          </Row>
        </View>
        <Step e={e} set={set} errors={errors} meta={meta} slugTouched={slugTouched} setSlugTouched={setSlugTouched} />
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.border, padding: space.md, gap: space.sm }}>
        <Row>
          <Button title="Previous" variant="secondary" onPress={() => goto(step - 1)} disabled={step === 0} style={{ flex: 1 }} />
          {step < STEPS.length - 1 ? <Button title="Next" onPress={next} style={{ flex: 1 }} /> : <Button title={isNew ? 'Create Event' : 'Save'} onPress={() => save(false)} loading={busy} style={{ flex: 1 }} />}
        </Row>
        <Row>
          <Button title="Cancel" variant="ghost" small onPress={() => router.back()} style={{ flex: 1 }} />
          <Button title="Save as draft" variant="ghost" small onPress={() => save(true)} disabled={busy} style={{ flex: 1 }} />
          {step < STEPS.length - 1 ? <Button title={isNew ? 'Create Event' : 'Save'} variant="ghost" small onPress={() => save(false)} disabled={busy} style={{ flex: 1 }} /> : null}
        </Row>
      </View>
    </View>
  );
}
