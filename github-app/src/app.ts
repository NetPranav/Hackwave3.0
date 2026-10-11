import type { Probot } from 'probot';
import { publishCodeMap, scanRepo } from './scan-repo.js';

/**
 * Probot app (P2.2). Webhooks are acknowledged immediately; scans run after the handler returns
 * so GitHub never waits (< 10 s rule). Scan progress is reported through the backend graph (SSE graph.updated).
 */
export default (app: Probot) => {
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
