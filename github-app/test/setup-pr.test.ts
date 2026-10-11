import { describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Project } from 'ts-morph';
import { openSetupPr, planSetup, type OctokitGit } from '../src/setup-pr.js';
import { scanDirectory } from '../src/scanner.js';

const fixture = fileURLToPath(new URL('./fixtures/shop', import.meta.url));
const copy = () => { const d = mkdtempSync(join(tmpdir(), 'seismo-setup-')); cpSync(fixture, d, { recursive: true }); return d; };
const apply = (dir: string, files: { path: string; content: string }[]) => { for (const f of files) { mkdirSync(dirname(join(dir, f.path)), { recursive: true }); writeFileSync(join(dir, f.path), f.content); } };

describe('setup PR codemod (P5.3)', () => {
  it('wraps fetch .json() and axios responses, adds the three seismo files and imports', () => {
    const dir = copy();
    try {
      const plan = planSetup(dir, 'demo/shop');
      const api = plan.files.find((f) => f.path === 'lib/api.ts')!.content;
      expect(api).toContain("withAliases(await res.json(), 'GET /users/{id}')");
      expect(api).toContain("res.json().then((b) => withAliases(b, 'GET /shipments/{id}'))");
      expect(api).toMatch(/import \{ withAliases \} from ["']\.\.\/seismo\/aliases["']/);
      const pay = plan.files.find((f) => f.path === 'lib/payments.ts')!.content;
      expect(pay).toContain("withAliasesResponse(await axios.get(`${process.env.PAYMENTS_API_URL}/payments/${id}`), 'GET /payments/{id}')");
      expect(plan.files.map((f) => f.path)).toEqual(expect.arrayContaining(['seismo/aliases.json', 'seismo/aliases.ts', 'seismo/aliases.test.ts']));
      expect(plan.skipped.some((s) => s.reason.includes('could not be resolved'))).toBe(true);   // the dynamic URL is reported
      expect(plan.wrapped.length).toBeGreaterThanOrEqual(4);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('the result still parses, is idempotent, and the scanner still sees the same field reads', () => {
    const dir = copy();
    try {
      const before = scanDirectory(dir, { repo: 'r', commit: 'a' });
      const plan = planSetup(dir, 'r');
      apply(dir, plan.files);
      const p = new Project({ compilerOptions: { allowJs: true, jsx: 4 }, skipAddingFilesFromTsConfig: true });
      p.addSourceFilesAtPaths(join(dir, '**/*.{ts,tsx}'));
      const syntax = p.getSourceFiles().flatMap((f) => (f.getPreEmitDiagnostics?.() ?? []).filter((d) => d.getCategory() === 1 && d.getCode() < 2000));
      expect(syntax).toEqual([]);                                              // no syntax errors (codes < 2000)
      expect(planSetup(dir, 'r').files).toEqual([]);                           // second run: nothing to do
      const after = scanDirectory(dir, { repo: 'r', commit: 'b' });
      const key = (m: typeof before) => m.fieldReads.map((r) => `${r.field}|${r.usage}`).sort();
      expect(key(after)).toEqual(expect.arrayContaining(key(before).filter((k) => !k.startsWith('data|'))));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('opens ONE commit with every file on seismo/setup, labelled, idempotent', async () => {
    const dir = copy();
    const calls: { op: string; args: Record<string, unknown> }[] = [];
    const rec = (op: string, ret: unknown) => async (args: Record<string, unknown>) => { calls.push({ op, args }); return ret; };
    const o = { rest: {
      repos: { get: rec('get', { data: { default_branch: 'main' } }) },
      git: { getRef: rec('getRef', { data: { object: { sha: 'base' } } }), getCommit: rec('getCommit', { data: { tree: { sha: 'tree0' } } }), createTree: rec('createTree', { data: { sha: 'tree1' } }), createCommit: rec('createCommit', { data: { sha: 'c1' } }), createRef: rec('createRef', {}) },
      pulls: { create: rec('pr', { data: { html_url: 'https://github.com/o/r/pull/2', number: 2 } }), list: rec('list', { data: [] }) },
      issues: { addLabels: rec('labels', {}) },
    } } as unknown as OctokitGit;
    try {
      const plan = planSetup(dir, 'o/r');
      expect(await openSetupPr(o, 'o', 'r', plan)).toEqual({ url: 'https://github.com/o/r/pull/2', number: 2, created: true });
      const tree = calls.find((c) => c.op === 'createTree')!.args['tree'] as { path: string }[];
      expect(tree.map((t) => t.path).sort()).toEqual(plan.files.map((f) => f.path).sort());
      expect(calls.filter((c) => c.op === 'createCommit')).toHaveLength(1);
      expect(calls.find((c) => c.op === 'createRef')!.args['ref']).toBe('refs/heads/seismo/setup');
      expect(String(calls.find((c) => c.op === 'pr')!.args['body'])).toContain('Behaviour does not change');
      (o.rest.pulls as unknown as { list: unknown }).list = async () => ({ data: [{ html_url: 'u', number: 2 }] });
      expect((await openSetupPr(o, 'o', 'r', plan)).created).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('the real demo shop (already wired by hand) needs nothing', () => {
    const shop = fileURLToPath(new URL('./fixtures/shop-wrapped', import.meta.url));
    const plan = planSetup(shop, 'NetPranav/seismo-demo-shop');
    expect(plan.files.filter((f) => !f.path.startsWith('seismo/'))).toEqual([]);
  });
});
