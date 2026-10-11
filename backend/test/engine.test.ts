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
  it('an earlier "field removed" (D1) on the renamed field is closed as explained once D3 sees the rename', async () => {
    const e = await scenario([codeMap([{ field: 'name', usage: 'display' }])], async (s) => void (await toggle(s, 'users-rename')));
    // as in a live run where D1 fired a pass before the new name could be scored
    const d1 = { id: 'drift-d1', service: 'users', endpoint: 'GET /users/{id}', field: 'name', detector: 'D1', title: 'Field removed: name', severity: 'breaking' as const, state: 'breaking' as const, confidence: 0.9, detectedAt: new Date(NOW - 10_000).toISOString(), before: { presence: 1 }, after: { presence: 0 }, usages: [] };
    (e as unknown as { events: Map<string, unknown> }).events.set('users|GET|/users/{id}|D1|name', { event: d1, runs: 3, lastSeen: NOW - 5000 });
    const changed = await e.run(NOW);
    const closed = e.list().find((x) => x.id === 'drift-d1')!;
    expect(closed.state).toBe('resolved');
    expect(closed.title).toBe('Field removed: name (explained: renamed to display_name)');
    expect(changed.map((c) => c.id)).toContain('drift-d1');   // so the dashboard and the GitHub issue are updated
  });
  it('when the provider goes back to normal, the confirmed change resolves after 3 passes with traffic (not without traffic)', async () => {
    const s = buildServices();
    const ingest = memoryIngest();
    for (let i = 0; i < 6; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: NOW - 15 * 60_000 + i * 5000 })) await ingest.add('dev', fp);
    await toggle(s, 'users-rename');
    for (let i = 0; i < 3; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: NOW - 30_000 + i * 5000 })) await ingest.add('dev', fp);
    const e = new DriftEngine(ingest, async () => [codeMap([{ field: 'name', usage: 'display' }])]);
    await e.run(NOW); await e.run(NOW + 5000);
    expect(e.list().find((x) => x.detector === 'D3')!.state).toBe('breaking');
    // no traffic at all for 10 minutes: nothing is known, nothing resolves
    const quiet = NOW + 10 * 60_000;
    for (let i = 0; i < 4; i++) await e.run(quiet + i * 5000);
    expect(e.list().find((x) => x.detector === 'D3')!.state).toBe('breaking');
    // the provider reverts and traffic flows again
    await toggle(s, 'users-rename', false);
    const back = NOW + 20 * 60_000;
    for (let i = 0; i < 3; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: back - 30_000 + i * 5000 })) await ingest.add('dev', fp);
    await e.run(back); await e.run(back + 1000);
    expect(e.list().find((x) => x.detector === 'D3')!.state).toBe('breaking');      // 2 passes: not yet
    const changed = await e.run(back + 2000);
    const d3 = e.list().find((x) => x.detector === 'D3')!;
    expect(d3.state).toBe('resolved');
    expect(changed.map((c) => c.id)).toContain(d3.id);                                // dashboard, issue and alerts hear about it
  });
  it('a rename still becomes D3 when the new field shows up a pass before the old one is gone (baseline must not learn it)', async () => {
    const s = buildServices();
    const ingest = memoryIngest();
    const T = NOW;
    for (let i = 0; i < 6; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: T - 15 * 60_000 + i * 5000 })) await ingest.add('dev', fp);
    for (let i = 0; i < 3; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: T - 50_000 + i * 5000 })) await ingest.add('dev', fp);  // v1 still in the window
    await toggle(s, 'users-rename');
    for (let i = 0; i < 4; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: T - 25_000 + i * 5000 })) await ingest.add('dev', fp);   // v2 half the window
    const e = new DriftEngine(ingest, async () => [codeMap([{ field: 'name', usage: 'display' }])]);
    await e.run(T);                                                          // window mixed: only D2 "new field"
    expect(e.list().some((x) => x.detector === 'D2')).toBe(true);
    expect(e.list().some((x) => x.detector === 'D3')).toBe(false);
    // 90 s later: the window is all v2 AND, without the freeze, the baseline would already contain v2 responses
    for (let i = 0; i < 18; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: T + i * 5000 })) await ingest.add('dev', fp);
    await e.run(T + 90_000); await e.run(T + 95_000);
    const d3 = e.list().find((x) => x.detector === 'D3');
    expect(d3?.title).toBe('Field renamed: name → display_name');
    expect(d3!.state).toBe('breaking');
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

describe('engine: endpoint-level findings', () => {
  it('Sunset and Deprecation are two events, not one overwriting the other', async () => {
    const s = buildServices();
    const ingest = memoryIngest();
    for (let i = 0; i < 6; i++) for (const fp of await capture(s, '/shipments/sh_1', 20, { service: 'shipping', at: NOW - 15 * 60_000 + i * 5000 })) await ingest.add('dev', fp);
    await toggle(s, 'shipping-deprecation');
    for (const fp of await capture(s, '/shipments/sh_1', 30, { service: 'shipping', at: NOW - 20_000 })) await ingest.add('dev', fp);
    const e = new DriftEngine(ingest, async () => []);
    await e.run(NOW); await e.run(NOW + 5000);
    const titles = e.list().filter((x) => x.detector === 'D13').map((x) => x.title);
    expect(titles.some((t) => t.startsWith('Sunset'))).toBe(true);
    expect(titles).toContain('Endpoint marked deprecated');
  });
  it('D17 fires through the engine when an endpoint starts returning 404', async () => {
    const s = buildServices();
    const ingest = memoryIngest();
    for (let i = 0; i < 6; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: NOW - 15 * 60_000 + i * 5000 })) await ingest.add('dev', fp);
    for (const fp of await capture(s, '/users/u_404', 30, { service: 'users', at: NOW - 20_000 })) await ingest.add('dev', fp);
    const e = new DriftEngine(ingest, async () => []);
    await e.run(NOW); await e.run(NOW + 5000);
    expect(e.list().some((x) => x.detector === 'D17')).toBe(true);
  });
});

import { memoryEvents } from '../src/event-store.js';
describe('restart safety (persisted events + baseline freeze)', () => {
  it('a restarted engine keeps the event, its id and its PR, and still sees the change after the broken traffic has aged into history', async () => {
    const s = buildServices();
    const ingest = memoryIngest();
    const store = memoryEvents();
    const map = codeMap([{ field: 'name', usage: 'display' }]);
    for (let i = 0; i < 6; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: NOW - 15 * 60_000 + i * 5000 })) await ingest.add('dev', fp);
    await toggle(s, 'users-rename');
    for (const fp of await capture(s, '/users/u_1', 40, { service: 'users', at: NOW - 30_000 })) await ingest.add('dev', fp);
    const prs: unknown[] = [];
    const fixer = { existingRules: async () => [], openPr: async (i: unknown) => { prs.push(i); return { url: 'https://github.com/demo/shop/pull/1', number: 1 }; } };
    const a = new DriftEngine(ingest, async () => [map], undefined, fixer, store);
    await a.run(NOW); await a.run(NOW + 5000);
    const before = a.list().find((e) => e.detector === 'D3')!;
    expect(before.state).toBe('fix_pending');

    // 10 minutes later: the v2 traffic above is now older than the window, and more v2 traffic arrives. New process.
    const LATER = NOW + 10 * 60_000;
    for (const fp of await capture(s, '/users/u_1', 40, { service: 'users', at: LATER - 30_000 })) await ingest.add('dev', fp);
    const b = new DriftEngine(ingest, async () => [map], undefined, fixer, store);
    await b.init();
    expect(b.list().map((e) => e.id)).toContain(before.id);                  // remembered before any detection pass
    const changed = await b.run(LATER);
    expect(changed).toEqual([]);                                              // nothing new -> no duplicate alerts
    expect(prs).toHaveLength(1);                                              // no second PR
    const after = b.list().find((e) => e.detector === 'D3')!;
    expect(after.id).toBe(before.id);
    expect(after.state).toBe('fix_pending');
  });
  it('without the freeze the change would vanish: the frozen baseline is what keeps D3 firing', async () => {
    const s = buildServices();
    const ingest = memoryIngest();
    for (let i = 0; i < 6; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: NOW - 15 * 60_000 + i * 5000 })) await ingest.add('dev', fp);
    await toggle(s, 'users-rename');
    for (let i = 0; i < 6; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: NOW - 8 * 60_000 + i * 5000 })) await ingest.add('dev', fp);
    for (const fp of await capture(s, '/users/u_1', 40, { service: 'users', at: NOW - 30_000 })) await ingest.add('dev', fp);
    const fresh = new DriftEngine(ingest, async () => []);                    // knows nothing: baseline is half v1, half v2
    await fresh.run(NOW); await fresh.run(NOW + 5000);
    expect(fresh.list().some((e) => e.detector === 'D3')).toBe(false);      // documents the failure mode the freeze prevents
  });
  it('resolved / expected events unfreeze the endpoint so the new shape becomes normal', async () => {
    const store = memoryEvents();
    await store.save([{ key: 'k', runs: 3, lastSeen: NOW, event: { id: 'drift-x', service: 'users', endpoint: 'GET /users/{id}', detector: 'D3', title: 't', severity: 'breaking', state: 'resolved', confidence: 0.9, detectedAt: new Date(NOW - 60_000).toISOString(), before: null, after: null, usages: [] } }]);
    const e = new DriftEngine(memoryIngest(), async () => [], undefined, undefined, store);
    await e.init();
    expect(e.list()[0]!.state).toBe('resolved');
  });
});

describe('fix CI tracking (P5.6)', () => {
  it('green CI on the fix PR adds C7 + C8 passed; red adds them failed', async () => {
    const calls: unknown[] = [];
    const base = await scenario([codeMap([{ field: 'name', usage: 'display' }])], async (s) => void (await toggle(s, 'users-rename')));
    const e = new DriftEngine((base as unknown as { ingest: never }).ingest, async () => [codeMap([{ field: 'name', usage: 'display' }])], undefined, { existingRules: async () => [], openPr: async (i: unknown) => { calls.push(i); return { url: 'u', number: 1 }; } });
    await e.run(NOW); await e.run(NOW + 5000);
    const id = e.list().find((x) => x.detector === 'D3')!.fix!.rule!.id!;
    const green = e.recordCi(id, 'success', 'GitHub Actions')!;
    expect(green.fix!.validation!.ci).toBe('green');
    expect(green.fix!.validation!.checks.map((c) => `${c.id}:${c.passed}`)).toEqual(['C1:true', 'C2:true', 'C3:true', 'C4:true', 'C5:true', 'C6:true', 'C7:true', 'C8:true']);
    const red = e.recordCi(id, 'failure')!;
    expect(red.fix!.validation!.ci).toBe('red');
    expect(red.fix!.validation!.checks.filter((c) => c.id === 'C8')).toEqual([{ id: 'C8', passed: false, detail: 'CI on the fix PR: failure' }]);
  });
});

describe('suggestion PR for a unit change (P5.10)', () => {
  it('only when a human asks, only for D5, rule = divide by the detected factor', async () => {
    const s = buildServices();
    const ingest = memoryIngest();
    for (let i = 0; i < 6; i++) for (const fp of await capture(s, '/payments/pay_1', 20, { service: 'payments', at: NOW - 15 * 60_000 + i * 5000 })) await ingest.add('dev', fp);
    await toggle(s, 'payments-paise');
    for (const fp of await capture(s, '/payments/pay_1', 40, { service: 'payments', at: NOW - 20_000 })) await ingest.add('dev', fp);
    const prs: { rule: unknown }[] = [];
    const map: CodeMap = { repo: 'demo/shop', commit: 'c', scannedAt: '2026-10-14T10:00:00.000Z', workflows: [], callSites: [{ id: 'p', repo: 'demo/shop', file: 'lib/pay.ts', line: 3, service: 'payments', method: 'GET', endpoint: '/payments/{id}' }], fieldReads: [{ callSiteId: 'p', field: 'amount', file: 'lib/pay.ts', line: 5, usage: 'arithmetic', money: true }] };
    const e = new DriftEngine(ingest, async () => [map], undefined, { existingRules: async () => [], openPr: async (i: { rule: unknown }) => { prs.push(i); return { url: 'https://github.com/demo/shop/pull/5', number: 5 }; } } as never);
    await e.run(NOW); await e.run(NOW + 5000);
    expect(prs).toHaveLength(0);                                                  // never automatic
    const d5 = e.list().find((x) => x.detector === 'D5')!;
    const r = await e.openScalePr(d5.id, 'demo/shop');
    expect(r.event!.state).toBe('fix_pending');
    expect(prs[0]!.rule).toMatchObject({ kind: 'scale', endpoint: 'GET /payments/{id}', path: '$', field: 'amount', divideBy: 100 });
    expect(r.event!.fix!.rung).toBe('transform');
    const rename = await e.openScalePr('nope', 'demo/shop');
    expect(rename.error).toBe('unknown_event');
  });
});
