import type { AliasRule, ScaleRule, SeismoRule } from '@seismo/contracts';

/** The ONLY file a fix PR may touch (AGENTS.md rule 6). */
export const ALIASES_PATH = 'seismo/aliases.json';

export interface Check { id: string; passed: boolean; detail: string }

export interface OctokitFix {
  rest: {
    repos: {
      get: (p: { owner: string; repo: string }) => Promise<{ data: { default_branch: string } }>;
      getContent: (p: { owner: string; repo: string; path: string; ref: string }) => Promise<{ data: unknown }>;
      createOrUpdateFileContents: (p: Record<string, unknown>) => Promise<{ data?: { commit?: { sha?: string } } } | unknown>;
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
    checks?: { create: (p: Record<string, unknown>) => Promise<unknown> };
  };
}

export interface AliasFile { version: number; rules: SeismoRule[] }

const ruleKey = (r: SeismoRule) => (r.kind === 'scale' ? `scale|${r.endpoint}|${r.path}|${(r as ScaleRule).field}` : `alias|${r.endpoint}|${r.path}|${(r as AliasRule).target}`);
export const isScale = (r: SeismoRule): r is ScaleRule => r.kind === 'scale';

/** Append one rule to the file content; returns the new text. Refuses duplicates. Stable formatting keeps diffs to one rule. */
export function addRule(existing: string | null, rule: SeismoRule): string {
  let file: AliasFile = { version: 1, rules: [] };
  if (existing) {
    try { file = JSON.parse(existing) as AliasFile; } catch { throw new Error(`${ALIASES_PATH} is not valid JSON; refusing to touch it`); }
    if (!Array.isArray(file.rules)) throw new Error(`${ALIASES_PATH} has no rules array; refusing to touch it`);
  }
  if (file.rules.some((r) => (r.id && r.id === rule.id) || ruleKey(r) === ruleKey(rule))) throw new Error('a rule for this key already exists');
  file.rules.push(rule);
  return JSON.stringify(file, null, 2) + '\n';
}

export function prBody(rule: SeismoRule, checks: Check[], usages: { file: string; line: number }[], eventUrl?: string) {
  const tick = (c: Check) => `- ${c.passed ? '✅' : '❌'} **${c.id}** ${c.detail}`;
  if (isScale(rule)) return [
    `**Needs review.** Seismo saw every \`${rule.field}\` on \`${rule.endpoint}\` become ${rule.divideBy} times larger (a unit change). You asked for a suggested fix, so here it is:`,
    '', '### The change', `One data rule in \`${ALIASES_PATH}\`: divide \`${rule.field}\` by ${rule.divideBy} when the response arrives. No code is modified.`,
    '```json', JSON.stringify(rule, null, 2), '```',
    '**This changes values**, unlike an alias. Confirm the new unit with the provider before merging; if they switch back, this rule would be wrong and must be removed. Seismo never merges this and never opens it on its own.',
    '', '### Where it is used', ...(usages.length ? usages.slice(0, 8).map((u) => `- \`${u.file}:${u.line}\``) : ['- no reads found']),
    '', '### How to revert', `Delete the rule from \`${ALIASES_PATH}\` (or revert this PR).`, ...(eventUrl ? ['', `[Drift details in Seismo](${eventUrl})`] : []),
  ].join('\n');
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

export interface OpenFixInput { owner: string; repo: string; rule: SeismoRule; checks: Check[]; usages: { file: string; line: number }[]; eventId: string; eventUrl?: string }

/** Branch `seismo/alias-<id>`, commit ONE file, open the PR. Idempotent: an open PR for the branch is returned instead of a duplicate. */
export async function openAliasPr(octokit: OctokitFix, i: OpenFixInput): Promise<{ url: string; number: number; created: boolean }> {
  const { owner, repo, rule } = i;
  const branch = `seismo/${isScale(rule) ? 'scale' : 'alias'}-${rule.id ?? i.eventId}`;
  const title = isScale(rule) ? `fix(seismo): ${rule.endpoint} ${rule.field} ÷ ${rule.divideBy} (needs review)` : `fix(seismo): alias ${rule.endpoint} ${(rule as AliasRule).target} ← ${(rule as AliasRule).source}`;
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
  const put = (await octokit.rest.repos.createOrUpdateFileContents({
    owner, repo, path: ALIASES_PATH, branch, message: title,
    content: Buffer.from(next).toString('base64'), ...(sha ? { sha } : {}),
  })) as { data?: { commit?: { sha?: string } } };
  const pr = await octokit.rest.pulls.create({
    owner, repo, base, head: branch, title,
    body: prBody(rule, i.checks, i.usages, i.eventUrl),
  });
  await octokit.rest.issues.addLabels({ owner, repo, issue_number: pr.data.number, labels: isScale(rule) ? ['seismo', 'needs-review'] : ['seismo', 'auto-safe'] }).catch(() => undefined);
  const headSha = put.data?.commit?.sha;
  if (headSha && octokit.rest.checks && !isScale(rule)) await octokit.rest.checks.create(safetyCheckRun(owner, repo, headSha, rule, i.checks)).catch(() => undefined);
  return { url: pr.data.html_url, number: pr.data.number, created: true };
}

export const CHECK_NAME = 'Seismo safety checks';

/** P5.6: C1-C6 as a GitHub check run on the PR head commit. C7/C8 come from the repo's own CI. */
export function safetyCheckRun(owner: string, repo: string, headSha: string, rule: AliasRule, checks: Check[]) {
  const ok = checks.length > 0 && checks.every((c) => c.passed);
  return {
    owner, repo, name: CHECK_NAME, head_sha: headSha, status: 'completed', conclusion: ok ? 'success' : 'failure',
    output: {
      title: ok ? `All ${checks.length} safety checks passed` : `${checks.filter((c) => !c.passed).length} safety check(s) failed`,
      summary: [`Alias rule \`${rule.target} <- ${rule.source}\` on \`${rule.endpoint}\` (path \`${rule.path ?? '$'}\`).`, '', '| Check | Result | Detail |', '|---|---|---|',
        ...checks.map((c) => `| ${c.id} | ${c.passed ? '✅' : '❌'} | ${c.detail.replace(/\|/g, '/')} |`),
        '| C7 | ⏳ | property tests in your CI (seismo/aliases.test.ts) |', '| C8 | ⏳ | your CI on this PR |'].join('\n'),
    },
  };
}
