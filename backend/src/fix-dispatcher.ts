import type { SeismoRule } from '@seismo/contracts';
import type { FixDispatcher } from './drift-engine.js';
import type { GithubIssueSink } from './alerts/dispatcher.js';

/** Talks to the GitHub App service (which holds the installation tokens). */
export function httpFixDispatcher(baseUrl = process.env.GITHUB_APP_URL, token = process.env.INTERNAL_TOKEN ?? 'dev-internal'): FixDispatcher | undefined {
  if (!baseUrl) return undefined;
  const call = async (path: string, body: unknown) => {
    const r = await fetch(`${baseUrl}/internal/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-token': token }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`github-app ${path}: ${r.status} ${await r.text()}`);
    return r.json() as Promise<Record<string, unknown>>;
  };
  return {
    async existingRules(repo) { return ((await call('rules', { repo })).rules as SeismoRule[]) ?? []; },
    async openPr(i) { const r = await call('fix', i); return { url: String(r['url']), number: Number(r['number']) }; },
  };
}

/** GitHub issues go through the GitHub App service too (it holds the installation tokens). */
export function httpIssueSink(baseUrl = process.env.GITHUB_APP_URL, token = process.env.INTERNAL_TOKEN ?? 'dev-internal'): GithubIssueSink | undefined {
  if (!baseUrl) return undefined;
  return {
    async upsertIssue(i) {
      const r = await fetch(`${baseUrl}/internal/issue`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-token': token }, body: JSON.stringify(i), signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`github-app issue: ${r.status} ${await r.text()}`);
      return { url: String(((await r.json()) as { url?: string }).url ?? '') };
    },
  };
}

/** GitHub App installations (for /v1/me). */
export function httpInstallations(baseUrl = process.env.GITHUB_APP_URL, token = process.env.INTERNAL_TOKEN ?? 'dev-internal') {
  if (!baseUrl) return undefined;
  return async () => {
    const r = await fetch(`${baseUrl}/internal/installations`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-token': token }, body: '{}', signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`installations: ${r.status}`);
    return ((await r.json()) as { installations: { id: number; account: string }[] }).installations;
  };
}
