import type { Fingerprint } from '@seismo/contracts';

export interface FieldBaseline {
  n: number;                        // responses containing the field
  presence: number;                 // share of responses containing the field
  types: Record<string, number>;
  fmt: Record<string, number>;
  nullRate: number;
  enumValues: Record<string, number>;
  hashes: Record<string, number>;
  mag: Record<string, number>;
  lenP50?: number;
  numP50?: number;
  arrayLenMax?: number;
}
export interface EndpointBaseline {
  service: string; endpoint: string; method: string; statusClass: string;
  samples: number;
  firstSeen: number;
  ready: boolean;                   // 200 samples or 24 h of data (P3.5)
  fields: Record<string, FieldBaseline>;
  latencyP95: number;
  statusCounts: Record<string, number>;
  shapes: string[];                 // distinct shape hashes seen
  headers: { sunset?: string; deprecation?: string; rateLimitLimit?: string };
}

const add = (into: Record<string, number>, from?: Record<string, number>) => { for (const [k, v] of Object.entries(from ?? {})) into[k] = (into[k] ?? 0) + v; };

/** Aggregate windows of one endpoint+status class into a profile. Pure; detectors compare a recent window to a baseline. */
export function buildBaselines(fps: Fingerprint[], now = Date.now()): EndpointBaseline[] {
  const groups = new Map<string, Fingerprint[]>();
  for (const fp of fps) {
    const k = `${fp.service}|${fp.method}|${fp.endpoint}|${fp.statusClass}`;
    groups.set(k, [...(groups.get(k) ?? []), fp]);
  }
  return [...groups.values()].map((g) => {
    const samples = g.reduce((s, f) => s + f.count, 0);
    const first = Math.min(...g.map((f) => Date.parse(f.windowStart)));
    const fields: Record<string, FieldBaseline> = Object.create(null);
    const lenW: Record<string, number> = {}, numW: Record<string, number> = {};
    for (const fp of g) for (const [path, f] of Object.entries(fp.fields)) {
      const b = (fields[path] ??= { n: 0, presence: 0, types: {}, fmt: {}, nullRate: 0, enumValues: {}, hashes: {}, mag: {} });
      b.n += f.n; b.nullRate += f.nulls;
      add(b.types, f.types); add(b.fmt, f.fmt); add(b.enumValues, f.enumValues); add(b.hashes, f.hashes); add(b.mag, f.mag);
      if (f.len) { b.lenP50 = ((b.lenP50 ?? 0) * (lenW[path] ?? 0) + f.len.p50 * f.n) / ((lenW[path] ?? 0) + f.n); lenW[path] = (lenW[path] ?? 0) + f.n; }
      if (f.num) { b.numP50 = ((b.numP50 ?? 0) * (numW[path] ?? 0) + f.num.p50 * f.n) / ((numW[path] ?? 0) + f.n); numW[path] = (numW[path] ?? 0) + f.n; }
      if (f.arrayLen) b.arrayLenMax = Math.max(b.arrayLenMax ?? 0, f.arrayLen.max);
    }
    for (const b of Object.values(fields)) { b.presence = Math.min(1, b.n / samples); b.nullRate = b.n ? b.nullRate / b.n : 0; }
    const statusCounts: Record<string, number> = {};
    g.forEach((f) => add(statusCounts, f.statusCounts));
    const last = g.reduce((a, f) => (Date.parse(f.windowStart) > Date.parse(a.windowStart) ? f : a));
    const hdr = (k: 'sunset' | 'deprecation' | 'rateLimitLimit') => g.map((f) => f.headers[k]).find(Boolean);
    return {
      service: g[0]!.service, endpoint: g[0]!.endpoint, method: g[0]!.method, statusClass: g[0]!.statusClass, samples, firstSeen: first,
      ready: samples >= 200 || now - first >= 24 * 3600_000, fields,
      latencyP95: Math.max(...g.map((f) => f.latencyMs.p95)), statusCounts,
      shapes: [...new Set(g.map((f) => f.shapeHash))],
      headers: { ...(hdr('sunset') ? { sunset: hdr('sunset')! } : {}), ...(hdr('deprecation') ? { deprecation: hdr('deprecation')! } : {}), ...(last.headers.rateLimitLimit ? { rateLimitLimit: last.headers.rateLimitLimit } : {}) },
    };
  });
}
