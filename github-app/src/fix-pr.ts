import type { AliasRule } from '@seismo/contracts';

/** The ONLY file a fix PR may touch (AGENTS.md rule 6). */
export const ALIASES_PATH = 'seismo/aliases.json';

export interface Check { id: string; passed: boolean; detail: string }

export interface OctokitFix {
  rest: {
    repos: {
      get: (p: { owner: string; repo: string }) => Promise<{ data: { default_branch: string } }>;
      getContent: (p: { owner: string; repo: string; path: string; ref: string }) => Promise<{ data: unknown }>;
      createOrUpdateFileContents: (p: Record<string, unknown>) => Promise<unknown>;
    };
    git: {
      getRef: (p: { owner: string; repo: string; ref: string }) => Promise<{ data: { object: { sha: string } } }>;
      createRef: (p: { owner: string; repo: string; ref: string; sha: string }) => Promise<unknown>;
    };
    pulls: {
      create: (p: Record<string, unknown>) => Promise<{ data: { html_url: string; number: number } }>;
      list: (p: Record<string, unknown>) => Promise<{ data: { html_url: string; number: number }[] }>;
    };
    issues: { addLabels: (p: Record<string, unknown>) => Promise<unknown> };
  };
}

export interface AliasFile { version: number; rules: AliasRule[] }

/** Append one rule to the file content; returns the new text. Refuses duplicates. Stable formatting keeps diffs to one rule. */
export function addRule(existing: string | null, rule: AliasRule): string {
  let file: AliasFile = { version: 1, rules: [] };
  if (existing) {
    try { file = JSON.parse(existing) as AliasFile; } catch { throw new Error(`${ALIASES_PATH} is not valid JSON; refusing to touch it`); }
    if (!Array.isArray(file.rules)) throw new Error(`${ALIASES_PATH} has no rules array; refusing to touch it`);
  }
  if (file.rules.some((r) => r.id === rule.id || (r.endpoint === rule.endpoint && r.path === rule.path && r.target === rule.target))) throw new Error('a rule for this key already exists');
  file.rules.push(rule);
  return JSON.stringify(file, null, 2) + '\n';
}

export function prBody(rule: AliasRule, checks: Check[], usages: { file: string; line: number }[], eventUrl?: string) {
  const tick = (c: Check) => `- ${c.passed ? '✅' : '❌'} **${c.id}** ${c.detail}`;
  return [
    `Seismo noticed that \`${rule.endpoint}\` now sends \`${rule.source}\` where your code reads \`${rule.target}\`.`,
    '',
    '### The change',
    `One data rule in \`${ALIASES_PATH}\`. No code is modified.`,
    '```json', JSON.stringify(rule, null, 2), '```',
    `When a response lacks \`${rule.target}\` but has \`${rule.source}\`, the rule **adds** \`${rule.target}\` from \`${rule.source}\`. It never changes or removes anything that is already there, and old-shaped responses pass through untouched (proven by property tests).`,
    '',
    '### Safety checks', ...checks.map(tick),
    '- ⏳ **C7/C8** property tests and your CI run on this PR',
    '',
    '### Where it is used', ...(usages.length ? usages.slice(0, 8).map((u) => `- \`${u.file}:${u.line}\``) : ['- no reads found (the rule is still safe)']),
    '',
    '### How to revert', `Delete the rule from \`${ALIASES_PATH}\` (or revert this PR).`,
    ...(eventUrl ? ['', `[Drift details in Seismo](${eventUrl})`] : []),
    '',
    '*A human merges this; Seismo never does.*',
  ].join('\n');
}

export interface OpenFixInput { owner: string; repo: string; rule: AliasRule; checks: Check[]; usages: { file: string; line: number }[]; eventId: string; eventUrl?: string }

/** Branch `seismo/alias-<id>`, commit ONE file, open the PR. Idempotent: an open PR for the branch is returned instead of a duplicate. */
export async function openAliasPr(octokit: OctokitFix, i: OpenFixInput): Promise<{ url: string; number: number; created: boolean }> {
  const { owner, repo, rule } = i;
  const branch = `seismo/alias-${rule.id ?? i.eventId}`;
  const open = await octokit.rest.pulls.list({ owner, repo, head: `${owner}:${branch}`, state: 'open' });
  if (open.data[0]) return { url: open.data[0].html_url, number: open.data[0].number, created: false };

  const base = (await octokit.rest.repos.get({ owner, repo })).data.default_branch;
  let existing: string | null = null, sha: string | undefined;
  try {
    const got = (await octokit.rest.repos.getContent({ owner, repo, path: ALIASES_PATH, ref: base })).data as { content?: string; sha?: string };
    existing = Buffer.from(got.content ?? '', 'base64').toString('utf8'); sha = got.sha;
  } catch (e) {
    if ((e as { status?: number }).status !== 404) throw e;
  }
  const next = addRule(existing, rule);

  const baseSha = (await octokit.rest.git.getRef({ owner, repo, ref: `heads/${base}` })).data.object.sha;
  await octokit.rest.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: baseSha });
  await octokit.rest.repos.createOrUpdateFileContents({
    owner, repo, path: ALIASES_PATH, branch, message: `fix(seismo): alias ${rule.endpoint} ${rule.target} ← ${rule.source}`,
    content: Buffer.from(next).toString('base64'), ...(sha ? { sha } : {}),
  });
  const pr = await octokit.rest.pulls.create({
    owner, repo, base, head: branch, title: `fix(seismo): alias ${rule.endpoint} ${rule.target} ← ${rule.source}`,
    body: prBody(rule, i.checks, i.usages, i.eventUrl),
  });
  await octokit.rest.issues.addLabels({ owner, repo, issue_number: pr.data.number, labels: ['seismo', 'auto-safe'] }).catch(() => undefined);
  return { url: pr.data.html_url, number: pr.data.number, created: true };
}
