import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useCurrentUser } from '@/auth/session';
import { FilterChips, ListRow, PageHeader, Screen } from '@/components/layout';
import { Button, Card, EmptyState, Pill, Row, SectionTitle, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import { CrmTabs } from '@/features/crm/shared';
import { useEvalContext } from '@/features/crm/useCrm';
import { relativeTime } from '@/lib/format';
import { can } from '@/lib/rbac';
import { segmentMembers } from '@/lib/segments/evaluate';
import { SEGMENT_TEMPLATES } from '@/lib/segments/templates';

export default function Segments() {
  const me = useCurrentUser();
  const segments = useDb((s) => s.segments);
  const contacts = useDb((s) => s.contacts);
  const ctx = useEvalContext();
  const [chip, setChip] = useState<'all' | 'rules' | 'fixed'>('all');
  const canWrite = can(me, 'write:bookings');

  // Rule-based segments re-evaluate on every read.
  const counts = useMemo(() => new Map(segments.map((s) => [s.id, segmentMembers(s, contacts, ctx).length])), [segments, contacts, ctx]);
  const rows = segments.filter((s) => chip === 'all' || s.type === chip).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <Screen>
      <PageHeader
        title="Segments"
        description="Saved audiences for campaigns. Rule-based segments keep themselves up to date; fixed lists change only when you edit them."
        actions={canWrite ? <Button title="New segment" icon={Plus} onPress={() => router.push('/crm/segments/new')} /> : null}
      />
      <CrmTabs />
      <FilterChips
        value={chip}
        onChange={setChip}
        chips={[
          { value: 'all', label: 'All', count: segments.length },
          { value: 'rules', label: 'Rules', count: segments.filter((s) => s.type === 'rules').length },
          { value: 'fixed', label: 'Fixed lists', count: segments.filter((s) => s.type === 'fixed').length },
        ]}
      />
      {rows.length === 0 ? <EmptyState title="No segments yet" body="Start from a template below." /> : null}
      <View style={{ gap: 8 }}>
        {rows.map((s) => (
          <ListRow key={s.id} onPress={() => router.push(`/crm/segments/${s.id}`)}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="label" style={{ flex: 1 }}>
                {s.name}
              </Txt>
              <Pill label={s.type === 'fixed' ? 'Fixed list' : 'Rules'} tone={s.type === 'fixed' ? 'grey' : 'blue'} />
            </Row>
            {s.description ? <Txt v="faint">{s.description}</Txt> : null}
            <Txt v="small">
              {counts.get(s.id) ?? 0} contacts · edited {relativeTime(s.updatedAt)}
            </Txt>
          </ListRow>
        ))}
      </View>
      {canWrite ? (
        <Card>
          <SectionTitle title="Start from a template" />
          <View style={{ gap: 10 }}>
            {SEGMENT_TEMPLATES.map((t) => (
              <View key={t.key} style={{ gap: 2 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt v="label" style={{ flex: 1 }}>
                    {t.name}
                  </Txt>
                  <Button small variant="ghost" title="Use template" onPress={() => router.push(`/crm/segments/new?template=${t.key}`)} />
                </Row>
                <Txt v="faint">{t.description}</Txt>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
