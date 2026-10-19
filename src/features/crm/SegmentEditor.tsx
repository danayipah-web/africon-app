import { router, usePreventRemove } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useCurrentUser } from '@/auth/session';
import { TextField } from '@/components/form';
import { Screen } from '@/components/layout';
import { confirm, toast, toastError } from '@/components/overlays';
import { Avatar, Button, Card, Row, SectionTitle, SimNote, StatCard, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import { deleteSegment, saveSegment } from '@/data/repo/crm';
import type { Segment } from '@/domain/types';
import { can } from '@/lib/rbac';
import { canReceiveEmail, canReceiveSms, segmentMembers } from '@/lib/segments/evaluate';
import { SEGMENT_TEMPLATES } from '@/lib/segments/templates';
import { space } from '@/theme';
import { FilterBuilder } from './FilterBuilder';
import { openCampaign } from './shared';
import { useEvalContext } from './useCrm';

/** New / edit segment with live "Matching right now" panel (spec §6.4). */
export function SegmentEditor({ initial, isNew }: { initial: Segment; isNew: boolean }) {
  const me = useCurrentUser();
  const contacts = useDb((s) => s.contacts);
  const ctx = useEvalContext();
  const [seg, setSeg] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const canWrite = can(me, 'write:bookings');

  const disablePrevention = usePreventRemove(dirty, ({ repeat }) => {
    confirm({ title: 'Discard changes?', message: 'This segment has unsaved changes.', confirmLabel: 'Discard', destructive: true }).then((ok) => {
      if (ok) {
        setDirty(false);
        repeat();
      }
    });
  });

  const up = (p: Partial<Segment>) => {
    setDirty(true);
    setSeg((s) => ({ ...s, ...p }));
  };

  const members = useMemo(() => segmentMembers(seg, contacts, { ...ctx, segments: ctx.segments.filter((s) => s.id !== seg.id) }), [seg, contacts, ctx]);
  const emailable = members.filter(canReceiveEmail).length;
  const smsable = members.filter(canReceiveSms).length;

  const save = async () => {
    try {
      await saveSegment(seg);
      setDirty(false);
      disablePrevention();
      toast('Segment saved');
      router.replace('/crm/segments');
    } catch (e) {
      toastError(e);
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: 'Delete segment?', message: `"${seg.name}" will be deleted. Contacts are not affected.`, confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await deleteSegment(seg.id);
      setDirty(false);
      disablePrevention();
      router.replace('/crm/segments');
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="h1">{isNew ? 'New segment' : seg.name || 'Segment'}</Txt>
        {canWrite ? <Button title="Save segment" onPress={save} /> : null}
      </Row>
      <Card>
        <TextField label="Name" required value={seg.name} onChange={(v) => up({ name: v })} />
        <TextField label="Description" optional value={seg.description} onChange={(v) => up({ description: v })} helper="Helps teammates choose the right audience for a campaign" />
      </Card>

      <Card>
        <SectionTitle title="MATCHING RIGHT NOW" />
        <Txt v="h2">{members.length} contacts match</Txt>
        <Row gap={space.md} style={{ marginTop: 8 }}>
          <StatCard style={{ flex: 1 }} label="Can receive email" value={String(emailable)} />
          <StatCard style={{ flex: 1 }} label="Can receive SMS" value={String(smsable)} />
        </Row>
        <Txt v="caps" style={{ marginTop: 12, marginBottom: 6 }}>
          In this audience
        </Txt>
        {members.slice(0, 6).map((m) => (
          <Row key={m.id} style={{ paddingVertical: 4 }}>
            <Avatar name={m.fullName || m.email} size={28} />
            <View style={{ flex: 1 }}>
              <Txt v="small">{m.fullName || m.email}</Txt>
              <Txt v="faint">{m.email || m.phone}</Txt>
            </View>
          </Row>
        ))}
        {members.length > 6 ? <Txt v="faint">and {members.length - 6} more</Txt> : null}
        <Row style={{ marginTop: 8 }}>
          {canWrite && members.length ? <Button small title="Send campaign" variant="secondary" onPress={() => openCampaign({ contactIds: members.map((m) => m.id) })} /> : null}
        </Row>
      </Card>

      {seg.type === 'fixed' ? (
        <Card>
          <SectionTitle title="Who is in this segment" />
          <SimNote text="This is a fixed list: it changes only when you add contacts from the Contacts list (select → Add to list)." />
        </Card>
      ) : (
        <Card>
          <SectionTitle title="Who is in this segment" />
          <Txt v="faint" style={{ marginBottom: 8 }}>
            Start from a template
          </Txt>
          <Row wrap gap={6} style={{ marginBottom: space.md }}>
            {SEGMENT_TEMPLATES.map((t) => (
              <Button key={t.key} small variant="secondary" title={t.name} onPress={() => up({ rules: t.build(), name: seg.name || t.name, description: seg.description || t.description })} />
            ))}
          </Row>
          <FilterBuilder value={seg.rules} onChange={(rules) => up({ rules })} contacts={contacts} ctx={ctx} />
        </Card>
      )}
      {!isNew && canWrite ? <Button title="Delete segment" variant="dangerGhost" onPress={remove} /> : null}
    </Screen>
  );
}
