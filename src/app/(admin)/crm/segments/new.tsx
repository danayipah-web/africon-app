import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import type { Segment } from '@/domain/types';
import { SegmentEditor } from '@/features/crm/SegmentEditor';
import { newId } from '@/lib/ids';
import { emptyGroup } from '@/lib/segments/evaluate';
import { SEGMENT_TEMPLATES } from '@/lib/segments/templates';

export default function NewSegment() {
  const { template } = useLocalSearchParams<{ template?: string }>();
  const [initial] = useState<Segment>(() => {
    const t = SEGMENT_TEMPLATES.find((x) => x.key === template);
    return {
      id: newId(),
      name: t?.name ?? '',
      description: t?.description ?? '',
      type: 'rules',
      rules: t ? t.build() : emptyGroup(),
      contactIds: [],
      updatedAt: new Date().toISOString(),
    };
  });
  return <SegmentEditor initial={initial} isNew />;
}
