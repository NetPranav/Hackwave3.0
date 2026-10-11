import { ALIASES_PATH } from './fix-pr.js';

/**
 * P8.5 repo side of `npm run demo:reset`: close open Seismo PRs, delete their seismo/* branches, empty seismo/aliases.json.
 * Refuses any repo except the one named in DEMO_REPO, so it can never touch a real customer repo.
 */
export interface OctokitReset {
  rest: {
    repos: { get: (p: Record<string, unknown>) => Promise<{ data: { default_branch: string } }>; getContent: (p: Record<string, unknown>) => Promise<{ data: unknown }>; createOrUpdateFileContents: (p: Record<string, unknown>) => Promise<unknown> };
    pulls: { list: (p: Record<string, unknown>) => Promise<{ data: { number: number; head: { ref: string } }[] }>; update: (p: Record<string, unknown>) => Promise<unknown> };
    git: { deleteRef: (p: Record<string, unknown>) => Promise<unknown> };
  };
}

export async function resetDemoRepo(o: OctokitReset, repoFull: string, allowed = process.env.DEMO_REPO): Promise<{ closed: number; rulesCleared: boolean }> {
  if (!allowed || allowed.toLowerCase() !== repoFull.toLowerCase()) throw new Error(`refusing to reset ${repoFull}: only DEMO_REPO (${allowed ?? 'unset'}) may be reset`);
  const [owner, repo] = repoFull.split('/') as [string, string];
  const open = (await o.rest.pulls.list({ owner, repo, state: 'open', per_page: 100 })).data.filter((p) => p.head.ref.startsWith('seismo/'));
  for (const p of open) {
    await o.rest.pulls.update({ owner, repo, pull_number: p.number, state: 'closed' });
    await o.rest.git.deleteRef({ owner, repo, ref: `heads/${p.head.ref}` }).catch(() => undefined);
  }
  const base = (await o.rest.repos.get({ owner, repo })).data.default_branch;
  let rulesCleared = false;
  try {
    const got = (await o.rest.repos.getContent({ owner, repo, path: ALIASES_PATH, ref: base })).data as { content?: string; sha?: string };
    const file = JSON.parse(Buffer.from(got.content ?? '', 'base64').toString()) as { rules?: unknown[] };
    if (file.rules?.length) {
      await o.rest.repos.createOrUpdateFileContents({ owner, repo, path: ALIASES_PATH, branch: base, sha: got.sha, message: 'chore(seismo): demo reset (empty alias rules)', content: Buffer.from(JSON.stringify({ version: 1, rules: [] }, null, 2) + '\n').toString('base64') });
      rulesCleared = true;
    }
  } catch (e) { if ((e as { status?: number }).status !== 404) throw e; }
  return { closed: open.length, rulesCleared };
}
