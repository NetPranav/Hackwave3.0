import type { Fingerprint } from '@seismo/contracts';

export interface FieldBaseline {
  presence: number;                 // share of responses containing the field
  types: Record<string, number>;
  nullRate: number;
  enumValues: Record<string, number>;
  mag: Record<string, number>;
  arrayLenMax?: number;
}
export interface EndpointBaseline {
  service: string; endpoint: string; method: string;
  samples: number;
  firstSeen: number;
  ready: boolean;                   // 200 samples or 24 h of data (P3.5)
  fields: Record<string, FieldBaseline>;
  latencyP95: number;
  statusCounts: Record<string, number>;
}

const add = (into: Record<string, number>, from?: Record<string, number>) => { for (const [k, v] of Object.entries(from ?? {})) into[k] = (into[k] ?? 0) + v; };

/** Aggregate windows of one endpoint into a baseline profile. Pure; the drift detectors (P4) compare windows to this. */
export function buildBaselines(fps: Fingerprint[], now = Date.now()): EndpointBaseline[] {
  const groups = new Map<string, Fingerprint[]>();
  for (const fp of fps) {
    const k = `${fp.service}|${fp.method}|${fp.endpoint}`;
    groups.set(k, [...(groups.get(k) ?? []), fp]);
  }
  return [...groups.values()].map((g) => {
    const samples = g.reduce((s, f) => s + f.count, 0);
    const first = Math.min(...g.map((f) => Date.parse(f.windowStart)));
    const fields: Record<string, FieldBaseline> = {};
    const nSum: Record<string, number> = {};
    for (const fp of g) for (const [path, f] of Object.entries(fp.fields)) {
      const b = (fields[path] ??= { presence: 0, types: {}, nullRate: 0, enumValues: {}, mag: {} });
      nSum[path] = (nSum[path] ?? 0) + f.n;
      b.nullRate += f.nulls;
      add(b.types, f.types); add(b.enumValues, f.enumValues); add(b.mag, f.mag);
      if (f.arrayLen) b.arrayLenMax = Math.max(b.arrayLenMax ?? 0, f.arrayLen.max);
    }
    for (const [path, b] of Object.entries(fields)) { b.presence = (nSum[path] ?? 0) / samples; b.nullRate = (nSum[path] ?? 0) ? b.nullRate / nSum[path]! : 0; }
    const statusCounts: Record<string, number> = {};
    g.forEach((f) => add(statusCounts, f.statusCounts));
    return {
      service: g[0]!.service, endpoint: g[0]!.endpoint, method: g[0]!.method, samples, firstSeen: first,
      ready: samples >= 200 || now - first >= 24 * 3600_000, fields,
      latencyP95: Math.max(...g.map((f) => f.latencyMs.p95)), statusCounts,
    };
  });
}
