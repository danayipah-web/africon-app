import { Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { useCurrentUser } from '@/auth/session';
import { TextField } from '@/components/form';
import { PageHeader, Screen, Tabs } from '@/components/layout';
import { confirm, Sheet, toast, toastError } from '@/components/overlays';
import { Button, Card, IconButton, Row, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import { addMetadataOptions, deleteMetadataOption, editMetadataOption, METADATA_TABS, type MetadataKey } from '@/data/repo/settings';
import { can } from '@/lib/rbac';
import { useTheme } from '@/theme';

export default function EventMetadataScreen() {
  const { c } = useTheme();
  const me = useCurrentUser();
  const meta = useDb((s) => s.metadata);
  const [tab, setTab] = useState<MetadataKey>('prerequisites');
  const [draft, setDraft] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const canEdit = can(me, 'manage:system');
  const def = METADATA_TABS.find((t) => t.key === tab)!;
  const list = meta[tab];

  const add = async (raw: string) => {
    try {
      const r = await addMetadataOptions(tab, raw);
      const parts = [`${r.added} added`];
      if (r.duplicates) parts.push(`${r.duplicates} already existed`);
      if (r.rejected.length) parts.push(`${r.rejected.length} rejected: ${r.rejected[0]}`);
      toast(parts.join(' · '), r.rejected.length ? 'error' : 'success');
      return r.added > 0 || r.duplicates > 0;
    } catch (e) {
      toastError(e);
      return false;
    }
  };

  return (
    <Screen>
      <PageHeader title="Event metadata" description="Manage predefined options for event form fields" />
      <Tabs tabs={METADATA_TABS.map((t) => ({ value: t.key, label: t.label }))} value={tab} onChange={setTab} />
      <Card>
        <Txt v="caps">{def.caption}</Txt>
        <Txt v="faint" style={{ marginBottom: 8 }}>
          {list.length} options
        </Txt>
        {list.map((o, i) => (
          <Row key={`${o}-${i}`} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.border }}>
            <Txt style={{ flex: 1 }}>{o}</Txt>
            {canEdit ? (
              <>
                <IconButton
                  icon={Pencil}
                  label={`Edit ${o}`}
                  size={16}
                  onPress={() => {
                    setEditIdx(i);
                    setEditVal(o);
                  }}
                />
                <IconButton
                  icon={Trash2}
                  label={`Delete ${o}`}
                  size={16}
                  color={c.danger}
                  onPress={async () => {
                    if (await confirm({ title: 'Delete option?', message: `"${o}" will be removed from ${def.label}. Events that use it keep their copy.`, confirmLabel: 'Delete', destructive: true })) {
                      deleteMetadataOption(tab, i).catch(toastError);
                    }
                  }}
                />
              </>
            ) : null}
          </Row>
        ))}
      </Card>
      {canEdit ? (
        <Card>
          <Row>
            <View style={{ flex: 1 }}>
              <TextField value={draft} onChange={setDraft} placeholder="Add Option" maxLength={120} />
            </View>
            <Button
              title="Add"
              disabled={!draft.trim()}
              onPress={async () => {
                if (await add(draft)) setDraft('');
              }}
            />
          </Row>
          <Button title="Bulk Add" variant="ghost" onPress={() => setBulkOpen(true)} />
        </Card>
      ) : (
        <Txt v="muted">Only Admins can change event metadata.</Txt>
      )}

      <Sheet
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Add Multiple Options"
        subtitle="One option per line. Duplicates and invalid lines are skipped."
        footer={
          <Button
            title="Add all"
            disabled={!bulk.trim()}
            onPress={async () => {
              if (await add(bulk)) {
                setBulk('');
                setBulkOpen(false);
              }
            }}
          />
        }>
        <TextField multiline value={bulk} onChange={setBulk} placeholder={'Option one\nOption two'} />
      </Sheet>

      <Sheet
        open={editIdx !== null}
        onClose={() => setEditIdx(null)}
        title="Edit option"
        footer={
          <Button
            title="Save"
            onPress={async () => {
              try {
                await editMetadataOption(tab, editIdx!, editVal);
                setEditIdx(null);
              } catch (e) {
                toastError(e);
              }
            }}
          />
        }>
        <TextField value={editVal} onChange={setEditVal} maxLength={120} />
      </Sheet>
    </Screen>
  );
}
