import Papa from 'papaparse';

export function toCsv(rows: Record<string, unknown>[], columns?: string[]) {
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  return Papa.unparse({
    fields: cols,
    data: rows.map((r) => cols.map((c) => formatCell(r[c]))),
  });
}

function formatCell(v: unknown) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.join('; ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const res = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
  return { headers: res.meta.fields ?? [], rows: res.data };
}
