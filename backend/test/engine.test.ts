import { describe, expect, it } from 'vitest';
import type { CodeMap } from '@seismo/contracts';
import { buildServices } from '../../services/src/app.js';
import { DriftEngine } from '../src/drift-engine.js';
import { memoryIngest } from '../src/ingest-store.js';
import { capture, toggle } from './helpers.js';

const NOW = Date.parse('2026-10-14T10:20:00Z');
const codeMap = (reads: { field: string; usage: 'display' | 'arithmetic'; money?: boolean }[]): CodeMap => ({
  repo: 'demo/shop', commit: 'c', scannedAt: '2026-10-14T10:00:00.000Z',
  callSites: [{ id: 'cs1', repo: 'demo/shop', file: 'lib/api.ts', line: 6, service: 'users', method: 'GET', endpoint: '/users/{param}' }],
  fieldReads: reads.map((r, i) => ({ callSiteId: 'cs1', field: r.field, file: 'app/checkout/page.tsx', line: 20 + i, usage: r.usage, money: r.money ?? false })),
  workflows: [],
});

async function scenario(maps: CodeMap[], flipTo: (s: ReturnType<typeof buildServices>) => Promise<void>) {
  const s = buildServices();
  const ingest = memoryIngest();
  for (let i = 0; i < 6; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: NOW - 15 * 60_000 + i * 5000 })) await ingest.add('dev', fp);
  await flipTo(s);
  for (let i = 0; i < 3; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: NOW - 30_000 + i * 5000 })) await ingest.add('dev', fp);
  return Object.assign(new DriftEngine(ingest, async () => maps), { ingest });
}

describe('drift engine (P4.2/P4.5)', () => {
  it('rename that code reads: suspected on run 1, breaking on run 2, with usages and an alias fix', async () => {
    const e = await scenario([codeMap([{ field: 'name', usage: 'display' }, { field: 'email', usage: 'display' }])], async (s) => void (await toggle(s, 'users-rename')));
    await e.run(NOW);
    const first = e.list().find((x) => x.detector === 'D3')!;
    expect(first.state).toBe('suspected');
    await e.run(NOW + 5000);
    const ev = e.list().find((x) => x.detector === 'D3')!;
    expect(ev.id).toBe(first.id);
    expect(ev.state).toBe('breaking');                        // a renamed field the code reads is broken whatever the usage
    expect(ev.usages[0]!.file).toBe('app/checkout/page.tsx');
    expect(ev.fix).toEqual({ rung: 'alias', rule: { kind: 'alias', path: '$', endpoint: 'GET /users/{id}', source: 'display_name', target: 'name' } });
  });
  it('a field read in a branch/arithmetic is breaking once confirmed', async () => {
    const e = await scenario([codeMap([{ field: 'name', usage: 'arithmetic' }])], async (s) => void (await toggle(s, 'users-rename')));
    await e.run(NOW); await e.run(NOW + 5000);
    expect(e.list().find((x) => x.detector === 'D3')!.state).toBe('breaking');
  });
  it('removing a field nobody reads stays info (no alert)', async () => {
    const e = await scenario([codeMap([{ field: 'email', usage: 'display' }])], async (s) => void (await toggle(s, 'users-rename')));
    await e.run(NOW); await e.run(NOW + 5000);
    const d3 = e.list().find((x) => x.detector === 'D3')!;
    // code reads `email`, not `name`: the rename is real but harmless to us
    expect(d3.severity).toBe('info');
    expect(d3.state).toBe('normal');
  });
  it('no drift, no events', async () => {
    const e = await scenario([codeMap([{ field: 'name', usage: 'display' }])], async () => undefined);
    await e.run(NOW); await e.run(NOW + 5000);
    expect(e.list()).toEqual([]);
  });
});

describe('fix dispatch (P5.5/P5.9)', () => {
  const fixer = (calls: unknown[]) => ({
    existingRules: async () => [],
    openPr: async (i: unknown) => { calls.push(i); return { url: 'https://github.com/demo/shop/pull/9', number: 9 }; },
  });
  it('confirmed rename with passing checks opens ONE PR, state fix_pending, then merge resolves', async () => {
    const calls: unknown[] = [];
    const base = await scenario([codeMap([{ field: 'name', usage: 'display' }])], async (s) => void (await toggle(s, 'users-rename')));
    const e = new DriftEngine((base as unknown as { ingest: never }).ingest, async () => [codeMap([{ field: 'name', usage: 'display' }])], undefined, fixer(calls));
    await e.run(NOW);                      // suspected
    expect(calls).toHaveLength(0);
    await e.run(NOW + 5000);               // confirmed -> PR
    await e.run(NOW + 10000);              // no duplicate
    expect(calls).toHaveLength(1);
    const ev = e.list().find((x) => x.detector === 'D3')!;
    expect(ev.state).toBe('fix_pending');
    expect(ev.fix!.validation!.prUrl).toContain('/pull/9');
    expect(ev.fix!.validation!.checks.map((c) => c.id)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6']);
    expect(e.resolveByRule(ev.fix!.rule!.id!, true)!.state).toBe('resolved');
  });
  it('paise-style review items never open a PR', async () => {
    const calls: unknown[] = [];
    const s = buildServices();
    const ingest = memoryIngest();
    const pay = async (n: number, at: number, scenarioOn: boolean) => { if (scenarioOn) await toggle(s, 'payments-amount-type'); for (const fp of await capture(s, '/payments/pay_1', n, { service: 'payments', at })) await ingest.add('dev', fp); };
    for (let i = 0; i < 6; i++) await pay(20, NOW - 15 * 60_000 + i * 5000, false);
    await pay(60, NOW - 20_000, true);
    const map: CodeMap = { repo: 'demo/shop', commit: 'c', scannedAt: '2026-10-14T10:00:00.000Z', workflows: [], callSites: [{ id: 'p', repo: 'demo/shop', file: 'lib/pay.ts', line: 3, service: 'payments', method: 'GET', endpoint: '/payments/{param}' }], fieldReads: [{ callSiteId: 'p', field: 'amount', file: 'lib/pay.ts', line: 5, usage: 'arithmetic', money: true }] };
    const e = new DriftEngine(ingest, async () => [map], undefined, fixer(calls));
    await e.run(NOW); await e.run(NOW + 5000);
    expect(calls).toHaveLength(0);
    expect(e.reviewQueue().some((r) => r.event.detector === 'D4')).toBe(true);
  });
});
