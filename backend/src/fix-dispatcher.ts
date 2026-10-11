import type { AliasRule } from '@seismo/contracts';
import type { FixDispatcher } from './drift-engine.js';

/** Talks to the GitHub App service (which holds the installation tokens). */
export function httpFixDispatcher(baseUrl = process.env.GITHUB_APP_URL, token = process.env.INTERNAL_TOKEN ?? 'dev-internal'): FixDispatcher | undefined {
  if (!baseUrl) return undefined;
  const call = async (path: string, body: unknown) => {
    const r = await fetch(`${baseUrl}/internal/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-token': token }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`github-app ${path}: ${r.status} ${await r.text()}`);
    return r.json() as Promise<Record<string, unknown>>;
  };
  return {
    async existingRules(repo) { return ((await call('rules', { repo })).rules as AliasRule[]) ?? []; },
    async openPr(i) { const r = await call('fix', i); return { url: String(r['url']), number: Number(r['number']) }; },
  };
}
