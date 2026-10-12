// Test helper: real fake-service responses -> SDK fingerprinter -> Fingerprint windows (no mocks of the data path).
import type { Fingerprint } from '@seismo/contracts';
import { buildServices } from '../../services/src/app.js';
import { finish, observe, type FieldAcc, type FpConfig } from '../../sdk-node/src/fingerprint.js';
import { normalise } from '../../sdk-node/src/classify.js';
import { createHash } from 'node:crypto';

export const h = { 'x-admin-token': 'dev-admin' };
export const cfg: FpConfig = { salt: 'test-salt', enumAllowList: ['status'], neverInspect: [], maxFields: 500, maxDepth: 8, maxArrayItems: 50 };

export type Services = ReturnType<typeof buildServices>;
export const toggle = (s: Services, id: string, enabled = true) => s.inject({ method: 'POST', url: `/admin/scenarios/${id}`, headers: h, payload: { enabled } });

/** Call `path` n times and return the Fingerprint windows an SDK would send (split by status class). */
export async function capture(s: Services, path: string, n: number, opts: { service: string; method?: 'GET' | 'POST'; at: number; windowSeconds?: number; salt?: string }): Promise<Fingerprint[]> {
  const byClass = new Map<string, { accs: Map<string, FieldAcc>; statuses: Record<string, number>; count: number; headers: Record<string, string>; lat: number[] }>();
  const url = new URL(`http://x${path}`);
  const { endpoint, queryKeys, limit } = normalise(url);
  for (let i = 0; i < n; i++) {
    const res = await s.inject({ method: opts.method ?? 'GET', url: path });
    const cls = `${Math.floor(res.statusCode / 100)}xx`;
    const w = byClass.get(cls) ?? { accs: new Map(), statuses: {}, count: 0, headers: {}, lat: [] };
    byClass.set(cls, w);
    w.count++; w.statuses[String(res.statusCode)] = (w.statuses[String(res.statusCode)] ?? 0) + 1; w.lat.push(20 + (i % 7));
    for (const k of ['sunset', 'deprecation'] as const) if (res.headers[k]) w.headers[k] = String(res.headers[k]);
    observe(res.json(), w.accs, opts.salt ? { ...cfg, salt: opts.salt } : cfg);
  }
  return [...byClass].map(([cls, w]) => {
    const { fields } = finish(w.accs);
    return {
      v: 1 as const, service: opts.service, method: opts.method ?? 'GET', endpoint, statusClass: cls as Fingerprint['statusClass'],
      windowStart: new Date(opts.at).toISOString(), windowSeconds: opts.windowSeconds ?? 5, count: w.count, statusCounts: w.statuses,
      latencyMs: { p50: 22, p95: 26 }, headers: w.headers, reqQueryKeys: queryKeys, ...(limit !== undefined ? { reqLimit: limit } : {}),
      shapeHash: createHash('sha256').update(JSON.stringify(Object.entries(fields).map(([p, f]) => [p, Object.keys((f as { types: object }).types).sort()]).sort())).digest('hex').slice(0, 16),
      fields: fields as Fingerprint['fields'],
      ...(opts.salt ? { saltId: createHash('sha256').update(`seismo-salt-id|${opts.salt}`).digest('hex').slice(0, 12) } : {}),
    };
  });
}
