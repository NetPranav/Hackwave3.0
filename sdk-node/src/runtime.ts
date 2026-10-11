/**
 * @seismo/sdk/runtime: the one audited function that applies alias rules (docs/roadmap/P5 §1.2).
 *
 * Guarantees, proven by property tests in test/runtime.property.test.ts:
 *  G1 identity on the old shape: if no rule applies, the SAME object reference comes back
 *  G2 additive only: every key/value of the input survives; the only differences are added `target` keys
 *  G3 no prototype tricks: rules with unsafe names are ignored
 *  G4 never throws: any problem returns the input unchanged
 * The old field always wins: a rule only fills `target` when `target` is missing.
 */
export interface AliasRule { endpoint?: string; path?: string; target: string; source: string; kind?: string }

const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const FORBIDDEN = new Set([...Object.getOwnPropertyNames(Object.prototype), '__proto__', 'prototype']);
const MAX_SEGMENTS = 16;
const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

type Seg = string | typeof ALL;
const ALL = Symbol('*');

/** G3: names must be identifier-safe and not an Object.prototype key. */
export const safeName = (n: unknown): n is string => typeof n === 'string' && NAME.test(n) && !FORBIDDEN.has(n);

function parsePath(path: string): Seg[] | null {
  if (path === '$') return [];
  if (!path.startsWith('$')) return null;
  const segs: Seg[] = [];
  const re = /\.([A-Za-z_][A-Za-z0-9_]{0,63})|\[\*\]/gy;
  let i = 1;
  re.lastIndex = 1;
  while (i < path.length) {
    const m = re.exec(path);
    if (!m) return null;
    segs.push(m[1] !== undefined ? m[1] : ALL);
    i = re.lastIndex;
    if (segs.length > MAX_SEGMENTS) return null;
  }
  return segs.some((s) => typeof s === 'string' && FORBIDDEN.has(s)) ? null : segs;
}

const isPlain = (v: unknown): v is Record<string, unknown> => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
};
const dataProp = (o: object, k: string) => { const d = Object.getOwnPropertyDescriptor(o, k); return d && 'value' in d ? d : undefined; };

function applyAt(node: unknown, segs: Seg[], i: number, rule: { target: string; source: string }): unknown {
  if (i === segs.length) {
    if (!isPlain(node)) return node;
    const src = dataProp(node, rule.source);
    if (!src || hasOwn(node, rule.target)) return node;       // old field wins; nothing to add
    const copy: Record<string, unknown> = Object.assign(Object.create(Object.getPrototypeOf(node)), node);
    Object.defineProperty(copy, rule.target, { value: src.value, enumerable: true, writable: true, configurable: true });
    return copy;
  }
  const seg = segs[i]!;
  if (seg === ALL) {
    if (!Array.isArray(node)) return node;
    let out: unknown[] | undefined;
    for (let j = 0; j < node.length; j++) {
      const next = applyAt(node[j], segs, i + 1, rule);
      if (next !== node[j]) { out ??= node.slice(); out[j] = next; }
    }
    return out ?? node;
  }
  if (!isPlain(node)) return node;
  const d = dataProp(node, seg);
  if (!d) return node;
  const next = applyAt(d.value, segs, i + 1, rule);
  if (next === d.value) return node;
  const copy: Record<string, unknown> = Object.assign(Object.create(Object.getPrototypeOf(node)), node);
  Object.defineProperty(copy, seg, { value: next, enumerable: true, writable: true, configurable: true });
  return copy;
}

/** "GET /users/{id}" matches itself and concrete paths such as "GET /users/42". */
function endpointMatches(ruleEndpoint: string | undefined, endpoint: string | undefined) {
  if (!ruleEndpoint || !endpoint) return true;
  if (ruleEndpoint === endpoint) return true;
  const re = new RegExp('^' + ruleEndpoint.replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+') + '$');
  return re.test(endpoint);
}

export function applyAliases<T>(raw: T, rules: readonly AliasRule[] | undefined, endpoint?: string): T {
  try {
    if (!rules || rules.length === 0 || raw === null || typeof raw !== 'object') return raw;
    let cur: unknown = raw;
    for (const rule of rules) {
      if (!rule || (rule.kind !== undefined && rule.kind !== 'alias')) continue;
      if (!safeName(rule.target) || !safeName(rule.source) || rule.target === rule.source) continue;
      if (!endpointMatches(rule.endpoint, endpoint)) continue;
      const segs = parsePath(rule.path ?? '$');
      if (!segs) continue;
      cur = applyAt(cur, segs, 0, rule);
    }
    return cur as T;
  } catch {
    return raw;
  }
}

/**
 * Transforms (P5.10). Unlike aliases these CHANGE a value, so they are never automatic: Seismo only proposes them in a
 * `needs-review` PR that a human asked for. Supported kind: `scale` (divide one numeric field by an exact factor).
 * Guarantees, property-tested: T1 identity without matching rules (same reference) · T2 only the named numeric field
 * changes, exactly value / divideBy; strings, missing fields and non-numbers are untouched · T3 never throws.
 */
export interface ScaleRule { kind: 'scale'; endpoint?: string; path?: string; field: string; divideBy: number }

function scaleAt(node: unknown, segs: Seg[], i: number, rule: ScaleRule): unknown {
  if (i === segs.length) {
    if (!isPlain(node)) return node;
    const d = dataProp(node, rule.field);
    if (!d || typeof d.value !== 'number' || !Number.isFinite(d.value)) return node;
    const copy: Record<string, unknown> = Object.assign(Object.create(Object.getPrototypeOf(node)), node);
    Object.defineProperty(copy, rule.field, { value: d.value / rule.divideBy, enumerable: true, writable: true, configurable: true });
    return copy;
  }
  const seg = segs[i]!;
  if (seg === ALL) {
    if (!Array.isArray(node)) return node;
    let out: unknown[] | undefined;
    for (let j = 0; j < node.length; j++) { const n = scaleAt(node[j], segs, i + 1, rule); if (n !== node[j]) { out ??= node.slice(); out[j] = n; } }
    return out ?? node;
  }
  if (!isPlain(node)) return node;
  const d = dataProp(node, seg);
  if (!d) return node;
  const next = scaleAt(d.value, segs, i + 1, rule);
  if (next === d.value) return node;
  const copy: Record<string, unknown> = Object.assign(Object.create(Object.getPrototypeOf(node)), node);
  Object.defineProperty(copy, seg, { value: next, enumerable: true, writable: true, configurable: true });
  return copy;
}

export function applyTransforms<T>(raw: T, rules: readonly unknown[] | undefined, endpoint?: string): T {
  try {
    if (!rules || rules.length === 0 || raw === null || typeof raw !== 'object') return raw;
    let cur: unknown = raw;
    for (const r of rules as ScaleRule[]) {
      if (!r || r.kind !== 'scale' || !safeName(r.field) || typeof r.divideBy !== 'number' || !Number.isFinite(r.divideBy) || r.divideBy <= 0) continue;
      if (!endpointMatches(r.endpoint, endpoint)) continue;
      const segs = parsePath(r.path ?? '$');
      if (!segs) continue;
      cur = scaleAt(cur, segs, 0, r);
    }
    return cur as T;
  } catch {
    return raw;
  }
}
