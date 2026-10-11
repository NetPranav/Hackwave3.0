import type { Fingerprint, ServiceStatus, DriftState } from '@seismo/contracts';

export type ProviderState = ServiceStatus['provider'];

/** Statuspage-compatible providers we know (P3.6). Anything else shows "unknown". */
export const STATUSPAGE: Record<string, string> = {
  github: 'https://www.githubstatus.com/api/v2/summary.json',
  'api.github.com': 'https://www.githubstatus.com/api/v2/summary.json',
};

const cache = new Map<string, { at: number; state: ProviderState }>();
export async function providerStatus(service: string, fetcher: typeof fetch = fetch, ttlMs = 60_000): Promise<ProviderState> {
  const url = STATUSPAGE[service];
  if (!url) return 'unknown';
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.state;
  try {
    const j = (await (await fetcher(url, { signal: AbortSignal.timeout(4000) })).json()) as { status?: { indicator?: string } };
    const ind = j.status?.indicator;
    const state: ProviderState = ind === 'none' ? 'operational' : ind === 'minor' ? 'degraded' : ind ? 'outage' : 'unknown';
    cache.set(url, { at: Date.now(), state });
    return state;
  } catch { return 'unknown'; }
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Per service and endpoint health from the last `windowMs` of fingerprints. */
export function buildStatus(fps: Fingerprint[], opts: { now?: number; windowMs?: number; states?: Record<string, DriftState>; provider?: Record<string, ProviderState> } = {}): ServiceStatus[] {
  const now = opts.now ?? Date.now();
  const windowMs = opts.windowMs ?? 5 * 60_000;
  const minutes = windowMs / 60_000;
  const recent = fps.filter((f) => now - Date.parse(f.windowStart) <= windowMs + f.windowSeconds * 1000);
  const services = new Map<string, Fingerprint[]>();
  for (const f of recent) services.set(f.service, [...(services.get(f.service) ?? []), f]);

  return [...services].map(([service, list]) => {
    const total = sum(list.map((f) => f.count));
    const errors = sum(list.flatMap((f) => Object.entries(f.statusCounts).filter(([s]) => Number(s) >= 400).map(([, n]) => n)));
    const eps = new Map<string, Fingerprint[]>();
    for (const f of list) eps.set(`${f.method} ${f.endpoint}`, [...(eps.get(`${f.method} ${f.endpoint}`) ?? []), f]);
    const buckets = 12;
    const spark = Array.from({ length: buckets }, (_, i) => {
      const from = now - windowMs + (i * windowMs) / buckets, to = from + windowMs / buckets;
      return sum(list.filter((f) => { const t = Date.parse(f.windowStart); return t >= from && t < to; }).map((f) => f.count));
    });
    const stateOf = (key: string) => opts.states?.[key] ?? 'normal';
    const endpoints = [...eps].map(([key, g]) => {
      const n = sum(g.map((f) => f.count));
      const e = sum(g.flatMap((f) => Object.entries(f.statusCounts).filter(([s]) => Number(s) >= 400).map(([, c]) => c)));
      const r429 = sum(g.map((f) => f.statusCounts['429'] ?? 0));
      const [method, ...rest] = key.split(' ');
      return {
        endpoint: rest.join(' '), method: method!, state: stateOf(`ep:${service}:${key}`), callsPerMin: n / minutes, errorRate: n ? e / n : 0,
        p95Ms: Math.max(...g.map((f) => f.latencyMs.p95)), rate429: n ? r429 / n : 0, fieldsMapped: new Set(g.flatMap((f) => Object.keys(f.fields))).size,
      };
    });
    const sunsets = list.map((f) => f.headers.sunset).filter((x): x is string => !!x);
    const worst = (['breaking', 'fix_pending', 'suspected'] as DriftState[]).find((s) => endpoints.some((e) => e.state === s)) ?? stateOf(`svc:${service}`);
    return {
      service, state: worst, provider: opts.provider?.[service] ?? 'unknown', callsPerMin: total / minutes,
      errorRate: total ? errors / total : 0, p95Ms: Math.max(...list.map((f) => f.latencyMs.p95)),
      lastSeen: new Date(Math.max(...list.map((f) => Date.parse(f.windowStart) + f.windowSeconds * 1000))).toISOString(),
      ...(sunsets.length ? { upcomingChange: `Sunset ${sunsets[0]}` } : {}), sparkline: spark, endpoints,
    };
  });
}
