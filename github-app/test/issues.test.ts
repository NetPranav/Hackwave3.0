import { describe, expect, it } from 'vitest';
import { marker, upsertIssue, type OctokitIssues } from '../src/issues.js';

function fake() {
  const issues: { number: number; body: string; state: string; title: string; html_url: string }[] = [];
  const o: OctokitIssues = { rest: { issues: {
    listForRepo: async () => ({ data: issues.map((x) => ({ ...x })) }),
    create: async (p) => { const n = { number: issues.length + 1, body: String(p['body']), state: 'open', title: String(p['title']), html_url: `https://github.com/o/r/issues/${issues.length + 1}` }; issues.push(n); return { data: n }; },
    update: async (p) => { const x = issues.find((i) => i.number === p['issue_number'])!; Object.assign(x, { body: p['body'], state: p['state'], title: p['title'] }); return { data: x }; },
  } } };
  return { o, issues };
}
const base = { owner: 'o', repo: 'r', eventId: 'drift-1', title: '[Seismo] x', body: 'b', severity: 'breaking' };

describe('GitHub issue per drift event (P4.6)', () => {
  it('creates once, updates the same issue on state changes, closes on resolution', async () => {
    const { o, issues } = fake();
    expect((await upsertIssue(o, { ...base, state: 'breaking' })).created).toBe(true);
    expect((await upsertIssue(o, { ...base, state: 'fix_pending', body: 'PR open' })).created).toBe(false);
    await upsertIssue(o, { ...base, state: 'resolved' });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.state).toBe('closed');
    expect(issues[0]!.body).toContain(marker('drift-1'));
  });
  it('does not open an issue just to close it', async () => {
    const { o, issues } = fake();
    await upsertIssue(o, { ...base, eventId: 'drift-2', state: 'resolved' });
    expect(issues).toHaveLength(0);
  });
});
