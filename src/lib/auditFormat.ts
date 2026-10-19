/** Render audit details as readable chips; never prints "[object Object]" (spec §14.1). */
export function detailChips(details: Record<string, unknown>): string[] {
  const out: string[] = [];
  const walk = (prefix: string, v: unknown) => {
    if (v == null || v === '') return;
    if (Array.isArray(v)) {
      if (v.length) out.push(`${prefix} = ${v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ')}`);
    } else if (typeof v === 'object') {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) walk(prefix === 'filters' ? k : `${prefix}.${k}`, val);
    } else {
      out.push(`${prefix} = ${String(v)}`);
    }
  };
  for (const [k, v] of Object.entries(details)) walk(k, v);
  return out;
}
