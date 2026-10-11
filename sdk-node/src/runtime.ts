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
 * Transforms (P5.10, v2 fix templates). Unlike aliases these CHANGE a value, so they are never automatic: Seismo only
 * proposes them in a `needs-review` PR that a human asked for, after a stress test. Kinds, all on ONE named field:
 *  - scale:  divide a number by an exact factor (units: paise -> rupees)
 *  - coerce: lossless type conversion back to what the code expects ("499" -> 499 with to:"number"; 499 -> "499")
 *  - map:    replace a new enum value with a known one ({ "partially_shipped": "in_transit" })
 * Guarantees, property-tested: T1 identity without matching rules (same reference) · T2 only the named field changes,
 * and only when the template applies (a non-numeric string is never coerced, an unmapped value is never replaced) ·
 * T3 never throws · T4 coerce and map are idempotent (applying twice equals once; scale is applied once per response).
 */
export interface ScaleRule { kind: 'scale'; endpoint?: string; path?: string; field: string; divideBy: number }
export interface CoerceRule { kind: 'coerce'; endpoint?: string; path?: string; field: string; to: 'number' | 'string' }
export interface MapRule { kind: 'map'; endpoint?: string; path?: string; field: string; map: Record<string, string | number | boolean> }
export type TransformRule = ScaleRule | CoerceRule | MapRule;

/** Strict decimal number text: "499", "-3", "12.50". Not "", " ", "1e3", "0x10", "12abc". */
const NUMERIC = /^-?(0|[1-9][0-9]{0,14})(\.[0-9]{1,10})?$/;

function valueAt(node: unknown, segs: Seg[], i: number, field: string, fn: (v: unknown) => unknown): unknown {
  if (i === segs.length) {
    if (!isPlain(node)) return node;
    const d = dataProp(node, field);
    if (!d) return node;
    const next = fn(d.value);
    if (Object.is(next, d.value)) return node;
    const copy: Record<string, unknown> = Object.assign(Object.create(Object.getPrototypeOf(node)), node);
    Object.defineProperty(copy, field, { value: next, enumerable: true, writable: true, configurable: true });
    return copy;
  }
  const seg = segs[i]!;
  if (seg === ALL) {
    if (!Array.isArray(node)) return node;
    let out: unknown[] | undefined;
    for (let j = 0; j < node.length; j++) { const n = valueAt(node[j], segs, i + 1, field, fn); if (n !== node[j]) { out ??= node.slice(); out[j] = n; } }
    return out ?? node;
  }
  if (!isPlain(node)) return node;
  const d = dataProp(node, seg);
  if (!d) return node;
  const next = valueAt(d.value, segs, i + 1, field, fn);
  if (next === d.value) return node;
  const copy: Record<string, unknown> = Object.assign(Object.create(Object.getPrototypeOf(node)), node);
  Object.defineProperty(copy, seg, { value: next, enumerable: true, writable: true, configurable: true });
  return copy;
}

/** The value function of a transform rule, or undefined when the rule is malformed (then it is ignored). */
function transformFn(r: TransformRule): ((v: unknown) => unknown) | undefined {
  if (!r || !safeName(r.field)) return undefined;
  if (r.kind === 'scale') {
    if (typeof r.divideBy !== 'number' || !Number.isFinite(r.divideBy) || r.divideBy <= 0) return undefined;
    return (v) => (typeof v === 'number' && Number.isFinite(v) ? v / r.divideBy : v);
  }
  if (r.kind === 'coerce') {
    if (r.to === 'number') return (v) => (typeof v === 'string' && NUMERIC.test(v) ? Number(v) : v);
    if (r.to === 'string') return (v) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : v);
    return undefined;
  }
  if (r.kind === 'map') {
    const m = r.map;
    if (!m || typeof m !== 'object' || Array.isArray(m)) return undefined;
    const entries = Object.entries(m).filter(([k, v]) => k.length <= 128 && !FORBIDDEN.has(k) && ['string', 'number', 'boolean'].includes(typeof v));
    if (!entries.length) return undefined;
    const table = new Map(entries);
    return (v) => (typeof v === 'string' && table.has(v) ? table.get(v) : v);
  }
  return undefined;
}

export function applyTransforms<T>(raw: T, rules: readonly unknown[] | undefined, endpoint?: string): T {
  try {
    if (!rules || rules.length === 0 || raw === null || typeof raw !== 'object') return raw;
    let cur: unknown = raw;
    for (const r of rules as TransformRule[]) {
      if (!r || !['scale', 'coerce', 'map'].includes(r.kind)) continue;
      if (!endpointMatches(r.endpoint, endpoint)) continue;
      const fn = transformFn(r);
      if (!fn) continue;
      const segs = parsePath(r.path ?? '$');
      if (!segs) continue;
      cur = valueAt(cur, segs, 0, r.field, fn);
    }
    return cur as T;
  } catch {
    return raw;
  }
}
