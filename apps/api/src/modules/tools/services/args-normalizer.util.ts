/**
 * Centralized args normalizer — the harness "guidance" choke point.
 *
 * Small/free models emit tool arguments in many shapes (leading '@' on file
 * paths, numbers as strings, stray whitespace, empty optionals). Instead of
 * every tool re-implementing tolerance, normalize once here before validation.
 * Rules are conservative: only transformations proven necessary by the
 * stability suites, never semantic rewrites.
 */

const PATHISH_KEY = /(file|path|source|image|filename)/i;
const NUMERIC_KEYS = new Set([
  'row',
  'column',
  'limit',
  'qty',
  'maxrounds',
  'fontsize',
]);

function coerce(key: string, value: any): any {
  if (typeof value === 'string') {
    let v = value.trim();
    if (/^@/.test(v)) v = v.slice(1);
    if (!v) return undefined; // drop empty strings -> optional fields
    if (NUMERIC_KEYS.has(key.toLowerCase())) {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
    return v;
  }
  return value;
}

export function normalizeArgs(
  toolName: string,
  rawArgs: Record<string, any> | undefined,
): Record<string, any> {
  void toolName; // per-tool special cases can key off this later
  if (!rawArgs || typeof rawArgs !== 'object') return rawArgs ?? {};
  const out: Record<string, any> = {};
  for (const [k, val] of Object.entries(rawArgs)) {
    if (val === null || val === undefined) continue;
    let v = val;
    if (Array.isArray(v)) {
      v = v.map((item) =>
        typeof item === 'string' ? (coerce(k, item) ?? item) : item,
      );
    } else if (typeof v === 'object') {
      v = normalizeArgs(toolName, v);
    } else {
      v = coerce(k, v);
      if (v === undefined) continue;
    }
    // Drop empty containers produced by cleanup
    if (
      Array.isArray(v)
        ? v.length === 0
        : typeof v === 'object' && Object.keys(v).length === 0
    ) {
      continue;
    }
    out[k] = v;
  }
  return out;
}
