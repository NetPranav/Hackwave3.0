import { describe, expect, it } from 'vitest';
import { addRule, ALIASES_PATH, openAliasPr, type OctokitFix } from '../src/fix-pr.js';

const rule = { id: 'a-abc123', kind: 'alias' as const, endpoint: 'GET /users/{id}', path: '$', target: 'name', source: 'display_name', driftEvent: 'drift-abc123', addedAt: '2026-10-18' };

function fake(existing: string | null) {
  const calls: { op: string; args: Record<string, unknown> }[] = [];
  const rec = (op: string, ret: unknown) => async (args: Record<string, unknown>) => { calls.push({ op, args }); return ret; };
  const octokit = {
    rest: {
      repos: {
        get: rec('repos.get', { data: { default_branch: 'main' } }),
        getContent: async (args: Record<string, unknown>) => {
          calls.push({ op: 'getContent', args });
          if (existing === null) throw Object.assign(new Error('nf'), { status: 404 });
          return { data: { content: Buffer.from(existing).toString('base64'), sha: 'filesha' } };
        },
        createOrUpdateFileContents: rec('putFile', {}),
      },
      git: { getRef: rec('getRef', { data: { object: { sha: 'basesha' } } }), createRef: rec('createRef', {}) },
      pulls: { create: rec('pulls.create', { data: { html_url: 'https://github.com/o/r/pull/7', number: 7 } }), list: rec('pulls.list', { data: [] }) },
      issues: { addLabels: rec('labels', {}) },
    },
  } as unknown as OctokitFix;
  return { octokit, calls };
}

describe('addRule', () => {
  it('creates the file, appends a rule, refuses duplicates and broken files', () => {
    const first = addRule(null, rule);
    expect(JSON.parse(first)).toEqual({ version: 1, rules: [rule] });
    expect(() => addRule(first, rule)).toThrow(/already exists/);
    const second = addRule(first, { ...rule, id: 'a-2', target: 'email', source: 'emailAddress' });
    expect(JSON.parse(second).rules).toHaveLength(2);
    expect(() => addRule('{nope', rule)).toThrow(/not valid JSON/);
    expect(() => addRule('{"rules": 5}', rule)).toThrow(/no rules array/);
  });
});

describe('openAliasPr (P5.5)', () => {
  it('touches exactly one file, on a seismo/* branch, and opens a labelled PR', async () => {
    const { octokit, calls } = fake(JSON.stringify({ version: 1, rules: [] }));
    const pr = await openAliasPr(octokit, { owner: 'o', repo: 'r', rule, eventId: 'drift-abc123', usages: [{ file: 'app/checkout/page.tsx', line: 12 }], checks: [{ id: 'C1', passed: true, detail: 'names safe' }] });
    expect(pr).toEqual({ url: 'https://github.com/o/r/pull/7', number: 7, created: true });
    const writes = calls.filter((c) => c.op === 'putFile');
    expect(writes).toHaveLength(1);
    expect(writes[0]!.args['path']).toBe(ALIASES_PATH);
    expect(calls.find((c) => c.op === 'createRef')!.args['ref']).toBe('refs/heads/seismo/alias-a-abc123');
    const body = String(calls.find((c) => c.op === 'pulls.create')!.args['body']);
    expect(body).toContain('app/checkout/page.tsx:12');
    expect(body).toContain('✅ **C1**');
    expect(body).toContain('never changes or removes');
    expect(calls.find((c) => c.op === 'labels')!.args['labels']).toEqual(['seismo', 'auto-safe']);
    const written = JSON.parse(Buffer.from(String(writes[0]!.args['content']), 'base64').toString());
    expect(written.rules).toEqual([rule]);
    expect(writes[0]!.args['sha']).toBe('filesha');
  });
  it('creates aliases.json when it does not exist yet', async () => {
    const { octokit, calls } = fake(null);
    await openAliasPr(octokit, { owner: 'o', repo: 'r', rule, eventId: 'e', usages: [], checks: [] });
    expect(calls.find((c) => c.op === 'putFile')!.args['sha']).toBeUndefined();
  });
  it('is idempotent: an open PR for the branch is returned, nothing is written', async () => {
    const { octokit, calls } = fake('{"version":1,"rules":[]}');
    (octokit.rest.pulls as unknown as { list: unknown }).list = async () => ({ data: [{ html_url: 'https://github.com/o/r/pull/3', number: 3 }] });
    const pr = await openAliasPr(octokit, { owner: 'o', repo: 'r', rule, eventId: 'e', usages: [], checks: [] });
    expect(pr).toEqual({ url: 'https://github.com/o/r/pull/3', number: 3, created: false });
    expect(calls.some((c) => c.op === 'putFile')).toBe(false);
  });
});
