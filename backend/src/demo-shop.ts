/**
 * Where is the demo shop running right now? Candidates, best first, each checked with a real request:
 *   1. the URL `npm run demo:online` registered (it just deployed it)
 *   2. the repo's homepage on GitHub, then the URL of its latest Production deployment (public API, no token)
 *   3. the local shop (SHOP_LOCAL_URL, default http://localhost:3100)
 * A candidate counts only if it answers 200 itself: per-deployment Vercel URLs that redirect to a login page do not.
 * Nothing about the shop is hard-coded: the repo comes from DEMO_REPO or the scanned code map.
 */
export interface ShopLocation { url: string; live: boolean; source: 'registered' | 'repo-homepage' | 'github-deployment' | 'local'; checkedAt: string; tried: { url: string; source: string; ok: boolean; why?: string }[] }

type Fetch = typeof fetch;

export async function ping(url: string, fetchImpl: Fetch = fetch): Promise<{ ok: boolean; why?: string }> {
  try {
    const r = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(6000), headers: { 'user-agent': 'seismo-shop-check' } });
    if (r.status === 200) return { ok: true };
    const loc = r.headers.get('location') ?? '';
    return { ok: false, why: r.status >= 300 && r.status < 400 ? (/sso|login|auth/i.test(loc) ? 'behind a login' : `redirects to ${loc.slice(0, 60)}`) : `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, why: (e as Error).name === 'TimeoutError' ? 'no answer in 6 s' : 'unreachable' };
  }
}

/** Public GitHub data about the repo's hosting: homepage + latest Production deployment URL. */
export async function githubCandidates(repo: string, fetchImpl: Fetch = fetch): Promise<{ url: string; source: ShopLocation['source'] }[]> {
  const out: { url: string; source: ShopLocation['source'] }[] = [];
  const gh = (path: string) => fetchImpl(`https://api.github.com/repos/${repo}${path}`, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'seismo' }, signal: AbortSignal.timeout(6000) }).then((r) => (r.ok ? r.json() : undefined)).catch(() => undefined);
  const info = (await gh('')) as { homepage?: string | null } | undefined;
  if (info?.homepage && /^https?:\/\//.test(info.homepage)) out.push({ url: info.homepage, source: 'repo-homepage' });
  const deps = (await gh('/deployments?environment=Production&per_page=1')) as { id: number }[] | undefined;
  if (deps?.[0]) {
    const st = (await gh(`/deployments/${deps[0].id}/statuses?per_page=1`)) as { state: string; environment_url?: string }[] | undefined;
    if (st?.[0]?.state === 'success' && st[0].environment_url) out.push({ url: st[0].environment_url, source: 'github-deployment' });
  }
  return out;
}

export function shopLocator(opts: { repo: () => Promise<string | undefined>; localUrl?: string; fetchImpl?: Fetch; ttlMs?: number } ) {
  let registered: string | undefined;
  let cache: { at: number; value: ShopLocation } | undefined;
  const local = opts.localUrl ?? process.env.SHOP_LOCAL_URL ?? 'http://localhost:3100';
  const ttl = opts.ttlMs ?? 30_000;
  return {
    register(url: string) { registered = url.replace(/\/$/, ''); cache = undefined; },
    async locate(force = false): Promise<ShopLocation> {
      if (!force && cache && Date.now() - cache.at < ttl) return cache.value;
      const repo = await opts.repo().catch(() => undefined);
      const candidates = [
        ...(registered ? [{ url: registered, source: 'registered' as const }] : []),
        ...(repo ? await githubCandidates(repo, opts.fetchImpl) : []),
      ].filter((c, i, all) => all.findIndex((x) => x.url.replace(/\/$/, '') === c.url.replace(/\/$/, '')) === i);
      const tried: ShopLocation['tried'] = [];
      for (const c of candidates) {
        const p = await ping(c.url, opts.fetchImpl);
        tried.push({ url: c.url, source: c.source, ok: p.ok, ...(p.why ? { why: p.why } : {}) });
        if (p.ok) return (cache = { at: Date.now(), value: { url: c.url.replace(/\/$/, ''), live: true, source: c.source, checkedAt: new Date().toISOString(), tried } }).value;
      }
      const p = await ping(local, opts.fetchImpl);
      tried.push({ url: local, source: 'local', ok: p.ok, ...(p.why ? { why: p.why } : {}) });
      return (cache = { at: Date.now(), value: { url: local, live: false, source: 'local', checkedAt: new Date().toISOString(), tried } }).value;
    },
  };
}
