import type { Fingerprint } from '@seismo/contracts';

/**
 * In-memory rollup of fingerprints into 10-second buckets per endpoint, status class and salt (a step towards v3-P3.3).
 * A serverless app sends one small fingerprint per request: 2 requests a second for 2 hours is ~40,000 of them, and
 * re-aggregating that every pass starved a small host (found on Render free: the health check timed out and the engine
 * restarted). Merged, it is ~720 buckets per endpoint whatever the traffic. Every part is a count or a weighted
 * average, exactly how buildBaselines combines windows, so detection results do not change.
 */
export const BUCKET_MS = 10_000;
/** Bucket size for a detection window: at most 10 s and at most a sixth of the window, so a bucket never spans it. */
export const bucketMsFor = (windowMs: number) => Math.max(100, Math.min(BUCKET_MS, Math.floor(windowMs / 6)));

export const bucketKey = (fp: Fingerprint, ms = BUCKET_MS) =>
  `${fp.service}|${fp.method}|${fp.endpoint}|${fp.statusClass}|${fp.saltId ?? ''}|${Math.floor(Date.parse(fp.windowStart) / ms)}`;

type Counts = Record<string, number>;
const add = (a: Counts | undefined, b: Counts | undefined): Counts | undefined => {
  if (!a && !b) return undefined;
  const out: Counts = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b ?? {})) out[k] = (out[k] ?? 0) + v;
  return out;
};
const wavg = (a: number, wa: number, b: number, wb: number) => (wa + wb ? (a * wa + b * wb) / (wa + wb) : b);
const pct = (a: { p5: number; p50: number; p95: number } | undefined, wa: number, b: typeof a, wb: number) =>
  !a ? b : !b ? a : { p5: wavg(a.p5, wa, b.p5, wb), p50: wavg(a.p50, wa, b.p50, wb), p95: wavg(a.p95, wa, b.p95, wb) };

/** A new bucket from a fingerprint (a copy: the original stays untouched). */
export function startBucket(fp: Fingerprint, ms = BUCKET_MS): Fingerprint {
  const start = Math.floor(Date.parse(fp.windowStart) / ms) * ms;
  const copy = structuredClone(fp);
  delete copy.batchId;
  return { ...copy, windowStart: new Date(start).toISOString(), windowSeconds: Math.max(fp.windowSeconds, Math.ceil(ms / 1000)) };
}

/** Fold `fp` into bucket `b` (same endpoint, status class, salt and 10 s slot). */
export function mergeInto(b: Fingerprint, fp: Fingerprint): void {
  const wa = b.count, wb = fp.count;
  b.count += fp.count;
  b.statusCounts = add(b.statusCounts, fp.statusCounts) ?? {};
  b.latencyMs = { p50: wavg(b.latencyMs.p50, wa, fp.latencyMs.p50, wb), p95: Math.max(b.latencyMs.p95, fp.latencyMs.p95) };
  b.headers = { ...b.headers, ...Object.fromEntries(Object.entries(fp.headers).filter(([, v]) => v !== undefined)) };
  b.reqQueryKeys = [...new Set([...b.reqQueryKeys, ...fp.reqQueryKeys])];
  if (fp.reqLimit !== undefined) b.reqLimit = Math.max(b.reqLimit ?? 0, fp.reqLimit);
  b.shapeHash = fp.shapeHash;
  for (const [path, f] of Object.entries(fp.fields)) {
    const g = Object.hasOwn(b.fields, path) ? b.fields[path] : undefined;
    if (!g) { b.fields[path] = structuredClone(f); continue; }
    const na = g.n, nb = f.n;
    g.n += f.n;
    g.nulls += f.nulls;
    g.types = add(g.types, f.types) ?? {};
    g.fmt = add(g.fmt, f.fmt);
    g.mag = add(g.mag, f.mag);
    g.enumValues = add(g.enumValues, f.enumValues);
    g.hashes = add(g.hashes, f.hashes);
    g.len = pct(g.len, na, f.len, nb);
    g.num = pct(g.num, na, f.num, nb);
    if (f.arrayLen) {
      const a = g.arrayLen;
      g.arrayLen = !a ? f.arrayLen : {
        p50: wavg(a.p50, na, f.arrayLen.p50, nb),
        max: Math.max(a.max, f.arrayLen.max),
        atMax: a.max === f.arrayLen.max ? a.atMax + f.arrayLen.atMax : a.max > f.arrayLen.max ? a.atMax : f.arrayLen.atMax,
      };
    }
    if (f.idHashes?.length) g.idHashes = [...new Set([...(g.idHashes ?? []), ...f.idHashes])].slice(0, 500);
    for (const k of ['fmt', 'mag', 'enumValues', 'hashes', 'len', 'num'] as const) if (g[k] === undefined) delete g[k];
  }
}
