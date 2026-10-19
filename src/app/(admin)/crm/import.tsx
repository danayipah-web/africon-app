import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { Download, Upload } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useCurrentUser } from '@/auth/session';
import { Select } from '@/components/form';
import { PageHeader, Screen, Tabs } from '@/components/layout';
import { toast, toastError } from '@/components/overlays';
import { Button, Card, EmptyState, Row, SectionTitle, SimNote, StatCard, Txt } from '@/components/ui';
import { commitImport, planImport, type ImportPlan, type ImportRow } from '@/data/repo/crm';
import { parseCsv } from '@/lib/csv';
import { can } from '@/lib/rbac';
import { shareCsv } from '@/lib/share';
import { space } from '@/theme';

const TARGETS: { key: keyof ImportRow; label: string; guesses: string[] }[] = [
  { key: 'email', label: 'Email', guesses: ['email', 'e-mail', 'email address', 'mail'] },
  { key: 'phone', label: 'Phone', guesses: ['phone', 'mobile', 'phone number', 'telephone', 'whatsapp', 'tel'] },
  { key: 'fullName', label: 'Full name', guesses: ['full name', 'name', 'fullname', 'contact name'] },
  { key: 'firstName', label: 'First name', guesses: ['first name', 'firstname', 'given name'] },
  { key: 'lastName', label: 'Last name', guesses: ['last name', 'lastname', 'surname', 'family name'] },
  { key: 'company', label: 'Company', guesses: ['company', 'organisation', 'organization', 'employer', 'school'] },
  { key: 'jobTitle', label: 'Job title', guesses: ['job title', 'title', 'role', 'position'] },
  { key: 'country', label: 'Country', guesses: ['country'] },
  { key: 'city', label: 'City', guesses: ['city', 'town'] },
  { key: 'tags', label: 'Tags', guesses: ['tags', 'tag', 'labels'] },
  { key: 'notes', label: 'Notes', guesses: ['notes', 'note', 'comments'] },
];

function guessMapping(headers: string[]): Record<string, keyof ImportRow | ''> {
  const out: Record<string, keyof ImportRow | ''> = {};
  const used = new Set<string>();
  for (const h of headers) {
    const n = h.trim().toLowerCase().replace(/[_-]+/g, ' ');
    const t = TARGETS.find((x) => !used.has(x.key) && x.guesses.includes(n));
    out[h] = t?.key ?? '';
    if (t) used.add(t.key);
  }
  return out;
}

/** 4-step import: Upload → Map columns → Preview → Done (spec §6.6). */
export default function ImportContacts() {
  const me = useCurrentUser();
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [raw, setRaw] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, keyof ImportRow | ''>>({});
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [busy, setBusy] = useState(false);

  const rows: ImportRow[] = useMemo(
    () =>
      raw.map((r) => {
        const o: ImportRow = {};
        for (const [h, k] of Object.entries(mapping)) if (k) o[k] = (o[k] ? `${o[k]} ` : '') + (r[h] ?? '');
        return o;
      }),
    [raw, mapping],
  );
  const mapped = new Set(Object.values(mapping));
  const hasKey = mapped.has('email') || mapped.has('phone');

  if (!can(me, 'write:bookings')) return <EmptyState title="Not allowed" body="Your role cannot import contacts." />;

  const template = () =>
    shareCsv('contacts-template.csv', 'Full name,Email,Phone,Company,Job title,Country,City,Tags,Notes\nAma Mensah,ama@example.com,0241234567,Example Ltd,Marketing Manager,Ghana,Accra,vip;newsletter,Met at the summit\n').catch(toastError);

  const pick = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '*/*'], copyToCacheDirectory: true });
      if (r.canceled) return;
      const asset = r.assets[0]!;
      if (/\.xlsx?$/i.test(asset.name)) {
        // TODO(spec): Excel parsing; the test build reads CSV only.
        toast('Excel files are not supported in this test build yet. Save the sheet as CSV and try again.', 'error');
        return;
      }
      const text = await new File(asset.uri).text();
      const parsed = parseCsv(text);
      if (!parsed.headers.length || !parsed.rows.length) throw new Error('That file has no rows.');
      setFileName(asset.name);
      setHeaders(parsed.headers);
      setRaw(parsed.rows);
      setMapping(guessMapping(parsed.headers));
      setStep(1);
    } catch (e) {
      toastError(e);
    }
  };

  const toPreview = () => {
    setPlan(planImport(rows));
    setStep(2);
  };

  const commit = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      await commitImport(plan, fileName);
      setStep(3);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <PageHeader title="Import contacts" description="Duplicates merge automatically: on email first, then on the normalised phone number." />
      <Tabs
        tabs={['1 Upload', '2 Map columns', '3 Preview', '4 Done'].map((l, i) => ({ value: String(i), label: l }))}
        value={String(step)}
        onChange={(v) => {
          const n = Number(v);
          if (n < step && step < 3) setStep(n);
        }}
      />
      {step === 0 ? (
        <Card style={{ gap: space.md }}>
          <Row wrap>
            <Button small variant="secondary" icon={Download} title="CSV template" onPress={template} />
          </Row>
          <Txt>Drop a CSV file here. Any column layout works; you map columns next.</Txt>
          <Button title="Choose file" icon={Upload} onPress={pick} />
          <SimNote text="Each row needs an email or a phone number. Optional: first/last/full name, company, job title, country, city, tags, notes." />
        </Card>
      ) : null}
      {step === 1 ? (
        <Card>
          <SectionTitle title={`Map columns · ${fileName}`} sub={`${raw.length} rows found. Pick the CRM field for each column.`} />
          {headers.map((h) => (
            <View key={h} style={{ marginBottom: 4 }}>
              <Select
                label={h}
                helper={`e.g. "${raw[0]?.[h] ?? ''}"`}
                value={mapping[h] ?? ''}
                onChange={(v) => setMapping((m) => ({ ...m, [h]: v as keyof ImportRow | '' }))}
                options={[{ value: '', label: "Don't import" }, ...TARGETS.map((t) => ({ value: t.key, label: t.label }))]}
              />
            </View>
          ))}
          {!hasKey ? <Txt style={{ color: '#C62828' }}>Map at least one column to Email or Phone.</Txt> : null}
          <Row style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            <Button title="Back" variant="secondary" onPress={() => setStep(0)} />
            <Button title="Preview" disabled={!hasKey} onPress={toPreview} />
          </Row>
        </Card>
      ) : null}
      {step === 2 && plan ? (
        <>
          <Row gap={space.md}>
            <StatCard style={{ flex: 1 }} label="New" value={String(plan.create.length)} />
            <StatCard style={{ flex: 1 }} label="Updated" value={String(plan.update.length)} />
            <StatCard style={{ flex: 1 }} label="Skipped" value={String(plan.skipped.length)} />
          </Row>
          {plan.skipped.length ? (
            <Card>
              <SectionTitle title="Skipped rows" />
              {plan.skipped.slice(0, 20).map((s) => (
                <Txt key={s.row} v="small">
                  Row {s.row}: {s.reason}
                </Txt>
              ))}
              {plan.skipped.length > 20 ? <Txt v="faint">and {plan.skipped.length - 20} more</Txt> : null}
            </Card>
          ) : null}
          <Card>
            <SectionTitle title="First new contacts" />
            {plan.create.slice(0, 5).map((c) => (
              <Txt key={c.id} v="small">
                {c.fullName || '(no name)'} · {c.email || c.phone}
              </Txt>
            ))}
            {plan.create.length === 0 ? <Txt v="muted">No new contacts.</Txt> : null}
          </Card>
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button title="Back" variant="secondary" onPress={() => setStep(1)} />
            <Button title={`Import ${plan.create.length + plan.update.length}`} onPress={commit} loading={busy} disabled={plan.create.length + plan.update.length === 0} />
          </Row>
        </>
      ) : null}
      {step === 3 && plan ? (
        <Card style={{ gap: space.md }}>
          <Txt v="h2">Import finished</Txt>
          <Txt>
            {plan.create.length} new · {plan.update.length} updated · {plan.skipped.length} skipped
          </Txt>
          <Button title="View contacts" onPress={() => router.navigate('/crm')} />
          <Button
            title="Import another file"
            variant="secondary"
            onPress={() => {
              setStep(0);
              setPlan(null);
              setRaw([]);
              setHeaders([]);
            }}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
