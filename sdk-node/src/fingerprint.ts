import { formatOf, hasher, magnitude, numberFormat, percentile, type Fmt } from './classify.js';

export interface FpConfig {
  salt: string;
  /** Field paths (or last segments) whose enum labels may be sent in plain text, e.g. ['status', 'currency']. */
  enumAllowList: string[];
  neverInspect: string[];
  maxFields: number;
  maxDepth: number;
  maxArrayItems: number;
}

/** Per-field accumulator across the responses of one window. Raw values live here only in memory, briefly. */
export interface FieldAcc {
  n: number; nulls: number;
  types: Record<string, number>;
  fmt: Record<string, number>;
  lens: number[];
  mags: Record<string, number>;
  nums: number[];
  enumValues: Record<string, number>;
  hashes: Record<string, number>;
  arrayLens: number[];
  idHashes: Set<string>;
}

export const newAcc = (): FieldAcc => ({ n: 0, nulls: 0, types: {}, fmt: {}, lens: [], mags: {}, nums: [], enumValues: {}, hashes: {}, arrayLens: [], idHashes: new Set() });
const bump = (r: Record<string, number>, k: string) => { r[k] = (r[k] ?? 0) + 1; };

const allowed = (path: string, list: string[]) => {
  const last = path.split('.').pop()!.replace(/\[\]$/, '');
  return list.includes(path) || list.includes(last);
};

/** Walk one parsed response body and add its shape to the accumulators. */
export function observe(body: unknown, accs: Map<string, FieldAcc>, cfg: FpConfig) {
  const hash = hasher(cfg.salt);
  const get = (p: string) => {
    let a = accs.get(p);
    if (!a && accs.size < cfg.maxFields) { a = newAcc(); accs.set(p, a); }
    return a;
  };
  const walk = (v: unknown, path: string, depth: number, seenInThisResponse: Set<string>) => {
    if (depth > cfg.maxDepth || (path && allowed(path, cfg.neverInspect))) return;
    const acc = path ? get(path) : undefined;
    if (acc) {
      if (!seenInThisResponse.has(path)) { acc.n++; seenInThisResponse.add(path); }
      if (v === null) { acc.nulls++; bump(acc.types, 'null'); return; }
    }
    if (Array.isArray(v)) {
      if (acc) { bump(acc.types, 'array'); acc.arrayLens.push(v.length); }
      const items = v.slice(0, cfg.maxArrayItems);
      if (acc) for (const it of items) {
        const id = it && typeof it === 'object' ? (it as Record<string, unknown>)['id'] : undefined;
        if ((typeof id === 'string' || typeof id === 'number') && acc.idHashes.size < 50) acc.idHashes.add(hash(String(id)));
      }
      for (const it of items) walk(it, `${path}[]`, depth + 1, seenInThisResponse);
      return;
    }
    if (v && typeof v === 'object') {
      if (acc) bump(acc.types, 'object');
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) walk(child, path ? `${path}.${k}` : k, depth + 1, seenInThisResponse);
      return;
    }
    if (!acc) return;
    if (typeof v === 'string') {
      bump(acc.types, 'string');
      const f: Fmt = formatOf(v);
      bump(acc.fmt, f);
      acc.lens.push(v.length);
      if (f === 'enum_candidate' || f === 'currency_code') {
        if (allowed(path, cfg.enumAllowList)) { if (Object.keys(acc.enumValues).length < 20) bump(acc.enumValues, v); }
        else if (Object.keys(acc.hashes).length < 20) bump(acc.hashes, hash(v));
      }
    } else if (typeof v === 'number') {
      bump(acc.types, Number.isInteger(v) ? 'integer' : 'number');
      const nf = numberFormat(v);
      if (nf) bump(acc.fmt, nf);
      bump(acc.mags, String(magnitude(v)));
      acc.nums.push(v);
    } else if (typeof v === 'boolean') bump(acc.types, 'boolean');
  };
  walk(body, '', 0, new Set());
}

const sig = (x: number) => (x === 0 ? 0 : Number(x.toPrecision(3)));

/** Turn accumulators into the wire format. Numbers: percentiles only, only with >= 5 values (else held back). */
export function finish(accs: Map<string, FieldAcc>, minBatch = 5) {
  const out: Record<string, unknown> = {};
  const held = new Map<string, number[]>();
  for (const [path, a] of accs) {
    const f: Record<string, unknown> = { n: a.n, types: a.types, nulls: a.nulls };
    if (Object.keys(a.fmt).length) f['fmt'] = a.fmt;
    if (a.lens.length) f['len'] = { p5: percentile(a.lens, 0.05), p50: percentile(a.lens, 0.5), p95: percentile(a.lens, 0.95) };
    if (Object.keys(a.mags).length) f['mag'] = a.mags;
    // >= minBatch DISTINCT values, rounded to 3 significant figures: identical values would make a percentile equal one record's value.
    if (new Set(a.nums).size >= minBatch) f['num'] = { p5: sig(percentile(a.nums, 0.05)), p50: sig(percentile(a.nums, 0.5)), p95: sig(percentile(a.nums, 0.95)) };
    else if (a.nums.length) held.set(path, a.nums);
    if (Object.keys(a.enumValues).length) f['enumValues'] = a.enumValues;
    if (Object.keys(a.hashes).length) f['hashes'] = a.hashes;
    if (a.arrayLens.length) {
      const max = Math.max(...a.arrayLens);
      f['arrayLen'] = { p50: percentile(a.arrayLens, 0.5), max, atMax: a.arrayLens.filter((x) => x === max).length };
    }
    if (a.idHashes.size) f['idHashes'] = [...a.idHashes];
    out[path] = f;
  }
  return { fields: out, held };
}
