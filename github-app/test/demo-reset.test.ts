import { describe, expect, it } from 'vitest';
import { resetDemoRepo, type OctokitReset } from '../src/demo-reset.js';

function fake(rules: unknown[]) {
  const calls: { op: string; args: Record<string, unknown> }[] = [];
  const rec = (op: string, ret: unknown) => async (args: Record<string, unknown>) => { calls.push({ op, args }); return ret; };
  const o = { rest: {
    repos: { get: rec('get', { data: { default_branch: 'main' } }), getContent: rec('getContent', { data: { sha: 's1', content: Buffer.from(JSON.stringify({ version: 1, rules })).toString('base64') } }), createOrUpdateFileContents: rec('put', {}) },
    pulls: { list: rec('list', { data: [{ number: 3, head: { ref: 'seismo/alias-a-1' } }, { number: 4, head: { ref: 'feature/x' } }] }), update: rec('update', {}) },
    git: { deleteRef: rec('deleteRef', {}) },
  } } as unknown as OctokitReset;
  return { o, calls };
}

describe('demo repo reset (P8.5)', () => {
  it('closes only seismo/* PRs, deletes their branches, empties the rules', async () => {
    const { o, calls } = fake([{ kind: 'alias', target: 'name', source: 'display_name', endpoint: 'GET /users/{id}' }]);
    expect(await resetDemoRepo(o, 'NetPranav/seismo-demo-shop', 'NetPranav/seismo-demo-shop')).toEqual({ closed: 1, rulesCleared: true });
    expect(calls.filter((c) => c.op === 'update').map((c) => c.args['pull_number'])).toEqual([3]);
    expect(calls.find((c) => c.op === 'deleteRef')!.args['ref']).toBe('heads/seismo/alias-a-1');
    expect(JSON.parse(Buffer.from(String(calls.find((c) => c.op === 'put')!.args['content']), 'base64').toString())).toEqual({ version: 1, rules: [] });
  });
  it('refuses any repo that is not DEMO_REPO', async () => {
    const { o, calls } = fake([]);
    await expect(resetDemoRepo(o, 'someone/real-app', 'NetPranav/seismo-demo-shop')).rejects.toThrow(/refusing/);
    await expect(resetDemoRepo(o, 'NetPranav/seismo-demo-shop', undefined)).rejects.toThrow(/refusing/);
    expect(calls).toEqual([]);
  });
});
