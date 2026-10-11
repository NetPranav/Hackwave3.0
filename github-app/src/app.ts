import type { ApplicationFunctionOptions, Probot } from 'probot';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AliasRule } from '@seismo/contracts';
import { ALIASES_PATH, openAliasPr, type Check, type OctokitFix } from './fix-pr.js';
import { publishCodeMap, scanRepo } from './scan-repo.js';

/**
 * Probot app (P2.2). Webhooks are acknowledged immediately; scans run after the handler returns
 * so GitHub never waits (< 10 s rule). Scan progress is reported through the backend graph (SSE graph.updated).
 */
export default (app: Probot, opts: ApplicationFunctionOptions) => {
  const running = new Set<string>();

  async function scan(octokit: unknown, owner: string, repo: string, ref: string, sha: string) {
    const key = `${owner}/${repo}`;
    if (running.has(key)) return;
    running.add(key);
    try {
      const map = await scanRepo(octokit as never, owner, repo, ref, sha);
      await publishCodeMap(map);
      app.log.info({ repo: key, calls: map.callSites.length, reads: map.fieldReads.length }, 'scan published');
    } catch (err) {
      app.log.error({ err, repo: key }, 'scan failed');
    } finally {
      running.delete(key);
    }
  }

  internalRoutes(app, opts);
  watchFixPrs(app);

  const kick = (fn: () => Promise<void>) => void setImmediate(() => void fn());

  app.on('installation.created', async (ctx) => {
    for (const r of ctx.payload.repositories ?? []) {
      const [owner, repo] = r.full_name.split('/') as [string, string];
      kick(async () => {
        const meta = await ctx.octokit.rest.repos.get({ owner, repo });
        const branch = meta.data.default_branch;
        const head = await ctx.octokit.rest.repos.getBranch({ owner, repo, branch });
        await scan(ctx.octokit as never, owner, repo, branch, head.data.commit.sha);
      });
    }
  });

  app.on('installation_repositories.added', async (ctx) => {
    for (const r of ctx.payload.repositories_added) {
      const [owner, repo] = r.full_name.split('/') as [string, string];
      kick(async () => {
        const meta = await ctx.octokit.rest.repos.get({ owner, repo });
        const branch = meta.data.default_branch;
        const head = await ctx.octokit.rest.repos.getBranch({ owner, repo, branch });
        await scan(ctx.octokit as never, owner, repo, branch, head.data.commit.sha);
      });
    }
  });

  // Re-scan on every push to the default branch (P2.4).
  app.on('push', async (ctx) => {
    const { repository, ref, after } = ctx.payload;
    if (ref !== `refs/heads/${repository.default_branch}`) return;
    kick(() => scan(ctx.octokit as never, repository.full_name.split('/')[0]!, repository.name, repository.default_branch, after));
  });
};

const TOKEN = () => process.env.INTERNAL_TOKEN ?? 'dev-internal';

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
const send = (res: ServerResponse, code: number, body: unknown) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); };

/** Backend -> GitHub App calls (P5.5): read aliases.json, open a fix PR. */
export function internalRoutes(app: Probot, opts: ApplicationFunctionOptions) {
  type Handler = (req: IncomingMessage, res: ServerResponse) => unknown;
  const routes = new Map<string, Handler>();
  const router = { post: (path: string, h: Handler) => void routes.set(path, h) };
  // Probot v14: custom HTTP routes go through addHandler (return true when handled).
  opts.addHandler((req, res) => {
    const h = req.method === 'POST' ? routes.get((req.url ?? '').split('?')[0]!) : undefined;
    if (!h) return false;
    void h(req, res);
    return true;
  });
  const octokitFor = async (repo: string) => {
    const [owner, name] = repo.split('/') as [string, string];
    const appKit = await app.auth();
    const inst = await appKit.rest.apps.getRepoInstallation({ owner, repo: name });
    return { owner, name, kit: await app.auth(inst.data.id) };
  };
  router.post('/internal/rules', async (req: IncomingMessage, res: ServerResponse) => {
    if (req.headers['x-internal-token'] !== TOKEN()) return send(res, 401, { error: 'unauthorized' });
    try {
      const { repo } = (await readJson(req)) as { repo: string };
      const { owner, name, kit } = await octokitFor(repo);
      const base = (await kit.rest.repos.get({ owner, repo: name })).data.default_branch;
      try {
        const got = (await kit.rest.repos.getContent({ owner, repo: name, path: ALIASES_PATH, ref: base })).data as { content?: string };
        const rules = (JSON.parse(Buffer.from(got.content ?? '', 'base64').toString()) as { rules?: AliasRule[] }).rules ?? [];
        return send(res, 200, { rules });
      } catch (e) {
        if ((e as { status?: number }).status === 404) return send(res, 200, { rules: [] });
        throw e;
      }
    } catch (e) { return send(res, 500, { error: String(e) }); }
  });
  router.post('/internal/fix', async (req: IncomingMessage, res: ServerResponse) => {
    if (req.headers['x-internal-token'] !== TOKEN()) return send(res, 401, { error: 'unauthorized' });
    try {
      const b = (await readJson(req)) as { repo: string; rule: AliasRule; checks: Check[]; usages: { file: string; line: number }[]; eventId: string };
      const { owner, name, kit } = await octokitFor(b.repo);
      const pr = await openAliasPr(kit as unknown as OctokitFix, { owner, repo: name, rule: b.rule, checks: b.checks, usages: b.usages, eventId: b.eventId, eventUrl: process.env.DASHBOARD_URL ? `${process.env.DASHBOARD_URL}/app/drift/${b.eventId}` : undefined });
      return send(res, 200, pr);
    } catch (e) { return send(res, 500, { error: String(e) }); }
  });
}

/** PR merged/closed -> tell the backend so the drift event resolves and the graph turns green (P5.9). */
export function watchFixPrs(app: Probot) {
  app.on('pull_request.closed', async (ctx) => {
    const ref = ctx.payload.pull_request.head.ref;
    if (!ref.startsWith('seismo/alias-')) return;
    const ruleId = ref.slice('seismo/alias-'.length);
    await fetch(`${process.env.BACKEND_URL ?? 'http://localhost:4000'}/internal/fix-event`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-token': TOKEN() },
      body: JSON.stringify({ ruleId, merged: ctx.payload.pull_request.merged }),
    }).catch((err) => app.log.error({ err }, 'fix-event failed'));
  });
}
