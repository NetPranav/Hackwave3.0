import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { Node, Project, SyntaxKind, type CallExpression, type SourceFile } from 'ts-morph';
import { scanDirectory } from './scanner.js';

/**
 * P5.3 "Install Seismo adapters": a deterministic ts-morph codemod (no AI) that routes every provider response through
 * the alias runtime. With an empty seismo/aliases.json the change is identity-only (guarantee G1), so behaviour is unchanged.
 *   fetch:  `await res.json()`                 -> `withAliases(await res.json(), 'GET /users/{id}')`
 *           `return res.json()`                -> `return res.json().then((b) => withAliases(b, 'GET /users/{id}'))`
 *   axios:  `const r = await axios.get(...)`   -> `const r = withAliasesResponse(await axios.get(...), 'GET /users/{id}')`
 * Idempotent: already-wrapped expressions are left alone.
 */

import { planSdkInstall, type FileChange, type SdkSource } from './install-sdk.js';
export type { FileChange };
export interface SetupPlan { files: FileChange[]; wrapped: { file: string; line: number; endpoint: string }[]; skipped: { file: string; line: number; reason: string }[]; installed?: string[]; notes?: string[] }

const HELPER = `// Added by Seismo (setup PR). Routes provider responses through alias rules (data, not code).
// With no rules in aliases.json this is the identity: responses pass through unchanged.
import { applyAliases, applyTransforms, type AliasRule } from '@seismo/sdk/runtime';
import file from './aliases.json';

// any rule kind (alias, scale, coerce, map): applyAliases uses the aliases, applyTransforms the rest
const rules = (file as { rules: unknown[] }).rules as AliasRule[];

/** Parsed JSON body of a provider response: alias rules (add-only), then reviewed scale rules if any. */
export const withAliases = <T>(body: T, endpoint: string): T => applyTransforms(applyAliases(body, rules, endpoint), rules, endpoint);

/** axios-style response objects: only \`data\` is passed through the rules. */
export const withAliasesResponse = <R extends { data: unknown }>(res: R, endpoint: string): R => {
  const data = withAliases(res.data, endpoint);
  return data === res.data ? res : { ...res, data };
};
`;

const ALIASES_JSON = `{\n  "version": 1,\n  "rules": []\n}\n`;

const ALIASES_TEST = `// Added by Seismo: re-checks every rule in seismo/aliases.json in this repo's CI (no extra dependencies).
//  - alias rules (renames): G1 old shape untouched, G2 the new shape only gains the old name
//  - value rules (scale / coerce / map, always merged by a human): stress test on generated responses:
//    never throws, only the named field changes, the change is exactly what the rule says, coerce/map are idempotent
import { describe, expect, it } from 'vitest';
import { applyAliases, applyTransforms, type AliasRule } from '@seismo/sdk/runtime';
import file from './aliases.json';

type Rule = { kind?: string; endpoint?: string; path?: string; target?: string; source?: string; field?: string; divideBy?: number; to?: string; map?: Record<string, unknown> };
const rules = (file as { rules: Rule[] }).rules;
const aliases = rules.filter((r) => !r.kind || r.kind === 'alias') as AliasRule[];
const values = rules.filter((r) => r.kind === 'scale' || r.kind === 'coerce' || r.kind === 'map');

let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]!;
const sample = (r: Rule): unknown => {
  const keys = Object.keys(r.map ?? {});
  return pick<unknown>([
    Math.round(rnd() * 100000), rnd() * 1000, -7, 0, String(Math.round(rnd() * 100000)), (rnd() * 1000).toFixed(2), '', ' 12', '1e3', 'abc',
    null, true, ...keys, 'other_value',
  ]);
};
const NUMERIC = /^-?(0|[1-9][0-9]{0,14})(\\.[0-9]{1,10})?$/;
const expected = (r: Rule, v: unknown) =>
  r.kind === 'scale' ? (typeof v === 'number' && Number.isFinite(v) ? v / r.divideBy! : v)
  : r.kind === 'coerce' ? (r.to === 'number' ? (typeof v === 'string' && NUMERIC.test(v) ? Number(v) : v) : (typeof v === 'number' && Number.isFinite(v) ? String(v) : v))
  : (typeof v === 'string' && Object.prototype.hasOwnProperty.call(r.map ?? {}, v) ? r.map![v] : v);

describe('seismo/aliases.json', () => {
  it('alias rules are valid', () => {
    for (const r of aliases) {
      expect(r.target).toMatch(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/);
      expect(r.source).toMatch(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/);
      expect(r.target).not.toBe(r.source);
    }
  });
  for (const r of aliases) {
    it(\`\${r.endpoint} \${r.target} <- \${r.source}: G1 + G2\`, () => {
      const oldShape = { [r.target]: 'old', [r.source]: 'new', other: 1 };
      expect(applyAliases(oldShape, [r], r.endpoint)).toBe(oldShape);
      const newShape = { [r.source]: 'value', other: 1 };
      expect(applyAliases(newShape, [r], r.endpoint)).toEqual({ ...newShape, [r.target]: 'value' });
    });
  }
  for (const r of values) {
    it(\`\${r.kind} \${r.endpoint} \${r.field}: stress test on 500 generated responses\`, () => {
      const nested = (r.path ?? '$') !== '$';
      for (let i = 0; i < 500; i++) {
        const v = sample(r);
        const record = { [r.field!]: v, keep: 'same', n: i };
        const body = nested ? { data: [record, { ...record, n: -i }] } : record;
        const out = applyTransforms(body, [r], r.endpoint) as Record<string, unknown> & { data?: Record<string, unknown>[] };
        const recs = nested ? out.data! : [out];
        for (const o of recs) {
          expect(o['keep']).toBe('same');                                     // only the named field changes
          expect(o[r.field!]).toEqual(expected(r, v));                         // exactly what the rule says
        }
        if (r.kind !== 'scale') expect(applyTransforms(out, [r], r.endpoint)).toEqual(out);   // idempotent
      }
      expect(() => applyTransforms(null, [r], r.endpoint)).not.toThrow();
    });
  }
});
`;

const isWrapped = (n: Node) => {
  const p = n.getParentWhile((x) => Node.isParenthesizedExpression(x) || Node.isAwaitExpression(x)) ?? n;
  const call = (Node.isCallExpression(p.getParent()) ? p.getParent() : undefined) as CallExpression | undefined;
  return !!call && /^(withAliases|withAliasesResponse|applyAliases)$/.test(call.getExpression().getText());
};

function importPath(fromFile: string, root: string) {
  let r = relative(dirname(fromFile), join(root, 'seismo', 'aliases')).replace(/\\/g, '/');
  if (!r.startsWith('.')) r = `./${r}`;
  return r;
}

/** Plan the setup change for a checked-out repo. Pure: returns file contents, writes nothing. */
/** `sdk`: also install + start the SDK (v3-P1.2). Without it only the wrappers and seismo/ files are planned. */
export function planSetup(dir: string, repo: string, sdk?: SdkSource): SetupPlan {
  const map = scanDirectory(dir, { repo, commit: 'setup' });
  const project = new Project({ compilerOptions: { allowJs: true, jsx: 4 }, skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });
  const wrapped: SetupPlan['wrapped'] = [];
  const skipped: SetupPlan['skipped'] = [];
  const touched = new Map<string, SourceFile>();
  const modified = new Set<string>();

  for (const cs of map.callSites) {
    if (cs.unresolved) { skipped.push({ file: cs.file, line: cs.line, reason: 'URL could not be resolved statically' }); continue; }
    const sf = touched.get(cs.file) ?? project.addSourceFileAtPath(join(dir, cs.file));
    touched.set(cs.file, sf);
    const endpoint = `${cs.method} ${cs.endpoint}`;
    const call = sf.getDescendantsOfKind(SyntaxKind.CallExpression).find((c) => c.getStartLineNumber() === cs.line && /^(fetch|axios|got|ky|http|api|client)\b/.test(c.getExpression().getText()));
    if (!call) { skipped.push({ file: cs.file, line: cs.line, reason: 'call not found' }); continue; }
    const lit = JSON.stringify(endpoint).replace(/"/g, "'");
    const outer = call.getParentWhile((x) => Node.isAwaitExpression(x) || Node.isParenthesizedExpression(x)) ?? call;
    const holder = outer.getParent();

    if (call.getExpression().getText() !== 'fetch') {
      // axios-style: wrap the awaited response object
      if (isWrapped(call)) continue;
      if (Node.isVariableDeclaration(holder) && holder.getInitializer() === outer && Node.isAwaitExpression(outer)) {
        outer.replaceWithText(`withAliasesResponse(${outer.getText()}, ${lit})`);
        wrapped.push({ file: cs.file, line: cs.line, endpoint });
        modified.add(cs.file);
      } else skipped.push({ file: cs.file, line: cs.line, reason: 'axios call not assigned to a variable' });
      continue;
    }

    // fetch: find the .json() on this response (same variable, or chained)
    const jsons: CallExpression[] = [];
    if (Node.isVariableDeclaration(holder) && Node.isIdentifier(holder.getNameNode())) {
      for (const ref of (holder.getNameNode() as import('ts-morph').Identifier).findReferencesAsNodes()) {
        const pa = ref.getParent();
        if (Node.isPropertyAccessExpression(pa) && pa.getName() === 'json' && Node.isCallExpression(pa.getParent())) jsons.push(pa.getParent() as CallExpression);
      }
    } else if (Node.isPropertyAccessExpression(holder) && holder.getName() === 'json' && Node.isCallExpression(holder.getParent())) jsons.push(holder.getParent() as CallExpression);
    if (!jsons.length) { skipped.push({ file: cs.file, line: cs.line, reason: 'no .json() on the response' }); continue; }
    let did = false;
    for (const j of jsons) {
      if (isWrapped(j)) continue;
      const aw = j.getParent();
      if (Node.isAwaitExpression(aw)) { aw.replaceWithText(`withAliases(${aw.getText()}, ${lit})`); did = true; }
      else if (Node.isReturnStatement(aw)) { j.replaceWithText(`${j.getText()}.then((b) => withAliases(b, ${lit}))`); did = true; }
      else skipped.push({ file: cs.file, line: j.getStartLineNumber(), reason: '.json() used in an unsupported position' });
    }
    if (did) { wrapped.push({ file: cs.file, line: cs.line, endpoint }); modified.add(cs.file); }
  }

  const files: FileChange[] = [];
  for (const [rel, sf] of touched) {
    if (!modified.has(rel)) continue;
    const text = sf.getFullText();
    const imported = new Set(sf.getImportDeclarations().flatMap((d) => d.getNamedImports().map((n) => n.getAliasNode()?.getText() ?? n.getName())));
    const names = ['withAliases', 'withAliasesResponse'].filter((n) => new RegExp(`\\b${n}\\(`).test(text) && !imported.has(n) && !sf.getFunction(n) && !sf.getVariableDeclaration(n));
    if (names.length) sf.insertImportDeclaration(0, { namedImports: names, moduleSpecifier: importPath(join(dir, rel), dir) });
    const out = sf.getFullText();
    if (out !== readFileSync(join(dir, rel), 'utf8')) files.push({ path: rel, content: out });
  }
  if (!existsSync(join(dir, 'seismo', 'aliases.json'))) files.push({ path: 'seismo/aliases.json', content: ALIASES_JSON });
  if (!existsSync(join(dir, 'seismo', 'aliases.ts'))) files.push({ path: 'seismo/aliases.ts', content: HELPER });
  if (!existsSync(join(dir, 'seismo', 'aliases.test.ts'))) files.push({ path: 'seismo/aliases.test.ts', content: ALIASES_TEST });
  if (!sdk) return { files, wrapped, skipped };
  const install = planSdkInstall(dir, sdk);
  return { files: [...files, ...install.files], wrapped, skipped, installed: install.done, notes: install.notes };
}

export interface OctokitGit {
  rest: {
    repos: { get: (p: Record<string, unknown>) => Promise<{ data: { default_branch: string } }> };
    git: {
      getRef: (p: Record<string, unknown>) => Promise<{ data: { object: { sha: string } } }>;
      getCommit: (p: Record<string, unknown>) => Promise<{ data: { tree: { sha: string } } }>;
      createTree: (p: Record<string, unknown>) => Promise<{ data: { sha: string } }>;
      createBlob?: (p: Record<string, unknown>) => Promise<{ data: { sha: string } }>;
      createCommit: (p: Record<string, unknown>) => Promise<{ data: { sha: string } }>;
      createRef: (p: Record<string, unknown>) => Promise<unknown>;
    };
    pulls: { create: (p: Record<string, unknown>) => Promise<{ data: { html_url: string; number: number } }>; list: (p: Record<string, unknown>) => Promise<{ data: { html_url: string; number: number }[] }> };
    issues: { addLabels: (p: Record<string, unknown>) => Promise<unknown> };
  };
}

export function setupPrBody(plan: SetupPlan) {
  return [
    'This one-time pull request sets up Seismo: it **installs and starts the SDK** and lets Seismo fix renamed fields **with data instead of code**.',
    '',
    ...(plan.installed?.length ? ['### Installs the SDK', ...plan.installed.map((d) => `- ${d}`), '- After merging, set `SEISMO_KEY` (from Seismo → Settings → SDK keys) and `SEISMO_ENDPOINT` in your deployment.', ''] : []),
    ...(plan.notes?.length ? ['### Please do by hand', ...plan.notes.map((n) => `- ${n}`), ''] : []),
    '### What it changes',
    '- Adds `seismo/aliases.json` (empty), `seismo/aliases.ts` (a 10-line wrapper around `applyAliases` from `@seismo/sdk/runtime`) and `seismo/aliases.test.ts` (re-checks the safety guarantees in your CI).',
    `- Routes the parsed response of ${plan.wrapped.length} provider call(s) through \`withAliases(...)\`:`,
    ...plan.wrapped.map((w) => `  - \`${w.file}:${w.line}\` (\`${w.endpoint}\`)`),
    '',
    '**Behaviour does not change:** with no rules, `withAliases` returns the exact same object it receives (guarantee G1, property-tested). Later Seismo PRs only ever add one rule to `seismo/aliases.json`.',
    ...(plan.skipped.length ? ['', '### Not wrapped (review by hand)', ...plan.skipped.map((s) => `- \`${s.file}:${s.line}\`: ${s.reason}`)] : []),
    '',
    ...(plan.installed?.length ? [] : ['Requires the `@seismo/sdk` package (add it to `package.json` if this PR does not).', '']),
    '**Opened as a draft:** Seismo marks it ready for review once your CI passes on it.',
    '',
    '*Generated by a deterministic codemod, not by AI. A human merges this; Seismo never does.*',
  ].join('\n');
}

/** One commit with every file, on `seismo/setup`, then a PR labelled seismo + setup. Idempotent. */
export async function openSetupPr(o: OctokitGit, owner: string, repo: string, plan: SetupPlan): Promise<{ url: string; number: number; created: boolean }> {
  const branch = 'seismo/setup';
  const open = await o.rest.pulls.list({ owner, repo, head: `${owner}:${branch}`, state: 'open' });
  if (open.data[0]) return { url: open.data[0].html_url, number: open.data[0].number, created: false };
  if (!plan.files.length) throw new Error('nothing to change: the repo is already set up');
  const base = (await o.rest.repos.get({ owner, repo })).data.default_branch;
  const baseSha = (await o.rest.git.getRef({ owner, repo, ref: `heads/${base}` })).data.object.sha;
  const baseTree = (await o.rest.git.getCommit({ owner, repo, commit_sha: baseSha })).data.tree.sha;
  // binary files (the vendored SDK tarball) go up as base64 blobs; text files inline
  const entries = await Promise.all(plan.files.map(async (f) => {
    if (f.encoding !== 'base64') return { path: f.path, mode: '100644', type: 'blob', content: f.content };
    if (!o.rest.git.createBlob) throw new Error('binary file without createBlob');
    const blob = await o.rest.git.createBlob({ owner, repo, content: f.content, encoding: 'base64' });
    return { path: f.path, mode: '100644', type: 'blob', sha: blob.data.sha };
  }));
  const tree = await o.rest.git.createTree({ owner, repo, base_tree: baseTree, tree: entries });
  const commit = await o.rest.git.createCommit({ owner, repo, message: 'chore(seismo): install Seismo adapters (identity until a rule is added)', tree: tree.data.sha, parents: [baseSha] });
  await o.rest.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: commit.data.sha });
  // draft until the repo's CI is green on it (watchSetupCi marks it ready); repos without drafts get a normal PR
  const args = { owner, repo, base, head: branch, title: plan.installed?.length ? 'chore(seismo): install the Seismo SDK and adapters' : 'chore(seismo): install Seismo adapters', body: setupPrBody(plan) };
  const pr = await o.rest.pulls.create({ ...args, draft: true }).catch(() => o.rest.pulls.create(args));
  await o.rest.issues.addLabels({ owner, repo, issue_number: pr.data.number, labels: ['seismo', 'setup'] }).catch(() => undefined);
  return { url: pr.data.html_url, number: pr.data.number, created: true };
}
