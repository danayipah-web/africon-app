import { useState } from 'react';
import { View } from 'react-native';

import type { AuditLog } from '@/domain/types';
import { detailChips } from '@/lib/auditFormat';
import { dateTime, relativeTime } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/rbac';
import { radius, space, useTheme } from '@/theme';
import { SwitchRow } from './form';
import { Button, EmptyState, Row, Txt } from './ui';

/** Audit feed: action, details as key=value chips, relative time, actor (spec §2.3, §4). */
export function ActivityFeed({
  entries,
  pageSize = 10,
  showToggle = true,
  absoluteTime = false,
}: {
  entries: AuditLog[];
  pageSize?: number;
  showToggle?: boolean;
  absoluteTime?: boolean;
}) {
  const { c } = useTheme();
  const [changesOnly, setChangesOnly] = useState(true);
  const [limit, setLimit] = useState(pageSize);
  const list = changesOnly && showToggle ? entries.filter((e) => e.kind === 'write') : entries;
  const shown = list.slice(0, limit);
  return (
    <View>
      {showToggle ? <SwitchRow label="Show changes only" helper="Hide list and view actions" value={changesOnly} onChange={setChangesOnly} /> : null}
      {shown.length === 0 ? <EmptyState title="No activity yet" body="Changes made by your team appear here." /> : null}
      {shown.map((e) => {
        const chips = detailChips(e.details);
        return (
          <View key={e.id} style={{ paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border, gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="label" style={{ flex: 1 }}>
                {e.action}
              </Txt>
              <Txt v="faint">{absoluteTime ? dateTime(e.at) : relativeTime(e.at)}</Txt>
            </Row>
            <Txt v="faint">
              {e.actorEmail} ({e.actorRole === 'system' ? 'system' : ROLE_LABELS[e.actorRole]})
            </Txt>
            {chips.length ? (
              <Row wrap gap={6}>
                {chips.slice(0, 6).map((ch) => (
                  <View key={ch} style={{ backgroundColor: c.cardAlt, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: c.border }}>
                    <Txt v="faint" style={{ color: c.textMuted }} numberOfLines={1}>
                      {ch}
                    </Txt>
                  </View>
                ))}
              </Row>
            ) : null}
          </View>
        );
      })}
      {list.length > limit ? <Button title="Load more" variant="ghost" onPress={() => setLimit((l) => l + pageSize)} style={{ marginTop: space.sm }} /> : null}
    </View>
  );
}
