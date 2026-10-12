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
  it('the same change made AGAIN after the provider had gone back to normal is a new change (found live: it stayed "resolved")', async () => {
    const s = buildServices();
    const ingest = memoryIngest();
    const feed = async (at: number, n = 3) => { for (let i = 0; i < n; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: at + i * 5000 })) await ingest.add('dev', fp); };
    await feed(NOW - 15 * 60_000, 6);
    await toggle(s, 'users-rename'); await feed(NOW - 30_000);
    const e = new DriftEngine(ingest, async () => [codeMap([{ field: 'name', usage: 'display' }])]);
    await e.run(NOW); await e.run(NOW + 5000);
    const first = e.list().find((x) => x.detector === 'D3')!;
    await toggle(s, 'users-rename', false); const back = NOW + 20 * 60_000; await feed(back - 30_000);
    for (let i = 0; i < 3; i++) await e.run(back + i * 1000);
    expect(e.list().find((x) => x.detector === 'D3')!.state).toBe('resolved');
    await toggle(s, 'users-rename'); const again = NOW + 40 * 60_000; await feed(again - 30_000);
    await e.run(again); await e.run(again + 5000);
    const second = e.list().find((x) => x.detector === 'D3')!;
    expect(second.state).toBe('breaking');
    expect(second.id).not.toBe(first.id);
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
    expect(ev.fix!.validation!.checks.map((c) => c.id)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C9']);   // C9: stress test before the PR
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
    expect(green.fix!.validation!.checks.map((c) => `${c.id}:${c.passed}`)).toEqual(['C1:true', 'C2:true', 'C3:true', 'C4:true', 'C5:true', 'C6:true', 'C9:true', 'C7:true', 'C8:true']);
    const red = e.recordCi(id, 'failure')!;
    expect(red.fix!.validation!.ci).toBe('red');
    expect(red.fix!.validation!.checks.filter((c) => c.id === 'C8')).toEqual([{ id: 'C8', passed: false, detail: 'CI on the fix PR: failure' }]);
  });
});

describe('suggestion PR for a unit change (P5.10, v2 templates)', () => {
  it('only when a human asks; rule = divide by the detected factor; opened only after the stress test', async () => {
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
    const r = await e.openTemplatePr(d5.id, 'demo/shop');
    expect(r.event!.state).toBe('fix_pending');
    expect(r.event!.fix!.validation!.checks).toEqual([expect.objectContaining({ id: 'C9', passed: true })]);   // stress-tested before opening
    expect(prs[0]!.rule).toMatchObject({ kind: 'scale', endpoint: 'GET /payments/{id}', path: '$', field: 'amount', divideBy: 100 });
    expect(r.event!.fix!.rung).toBe('transform');
    const rename = await e.openTemplatePr('nope', 'demo/shop');
    expect(rename.error).toBe('unknown_event');
  });
});

describe('provider goes back to the shape the code reads (found live: a reverse alias was proposed)', () => {
  it('a learned rename being reverted is reported as "restored" with no fix, never as alias display_name ← name', async () => {
    const s = buildServices();
    const ingest = memoryIngest();
    // Seismo learned the CHANGED shape (the rename happened during learning / before a reset), then the provider reverts
    await toggle(s, 'users-rename');
    for (let i = 0; i < 6; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: NOW - 15 * 60_000 + i * 5000 })) await ingest.add('dev', fp);
    await toggle(s, 'users-rename', false);
    for (let i = 0; i < 3; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: NOW - 30_000 + i * 5000 })) await ingest.add('dev', fp);
    const e = new DriftEngine(ingest, async () => [codeMap([{ field: 'name', usage: 'display' }])]);
    await e.run(NOW); await e.run(NOW + 5000);
    const ev = e.list().find((x) => x.detector === 'D3')!;
    expect(ev.title).toBe('Field restored: name is back (it was display_name); your code reads name');
    expect(ev.fix).toBeUndefined();
    expect(ev.state).toBe('normal');
  });
});

describe('the app restarts with a new salt (found live: "New carrier value: value #d5ca07" after a restart)', () => {
  const run = async (withSaltIds: boolean) => {
    const s = buildServices();
    const ingest = memoryIngest();
    const keep = (fp: Awaited<ReturnType<typeof capture>>[number]) => (withSaltIds ? fp : { ...fp, saltId: undefined });
    for (let i = 0; i < 12; i++) for (const fp of await capture(s, '/shipments/sh_1', 20, { service: 'shipping', at: NOW - 15 * 60_000 + i * 5000, salt: 'salt-before' })) await ingest.add('dev', keep(fp));
    for (let i = 0; i < 3; i++) for (const fp of await capture(s, '/shipments/sh_1', 20, { service: 'shipping', at: NOW - 30_000 + i * 5000, salt: 'salt-after-restart' })) await ingest.add('dev', keep(fp));
    const e = new DriftEngine(ingest, async () => []);
    await e.run(NOW); await e.run(NOW + 5000);
    return e.list().map((x) => x.title);
  };
  it('without salt ids a restart looks like new values (the old behaviour this guards against)', async () => {
    expect((await run(false)).some((t) => t.startsWith('New '))).toBe(true);
  });
  it('with salt ids: no change, nothing reported', async () => {
    expect(await run(true)).toEqual([]);
  });
});

describe('learning progress (found live: a change made while Seismo was still learning was silently learned)', () => {
  it('reports per endpoint how many baseline samples it has and whether changes count yet', async () => {
    const s = buildServices();
    const ingest = memoryIngest();
    for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: NOW - 5 * 60_000 })) await ingest.add('dev', fp);
    for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: NOW - 10_000 })) await ingest.add('dev', fp);
    const e = new DriftEngine(ingest, async () => []);
    await e.run(NOW);
    expect(e.readiness()).toEqual([{ service: 'users', endpoint: 'GET /users/{id}', samples: 20, needed: 50, ready: false }]);
    for (let i = 1; i < 3; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: NOW - 5 * 60_000 + i * 5000 })) await ingest.add('dev', fp);
    await e.run(NOW + 1000);
    expect(e.readiness()[0]).toMatchObject({ samples: 60, ready: true });
  });
});

describe('unit change explains the earlier "value distribution changed" (found by the pipeline run: 2 extra D6 events)', () => {
  it('an open D6 on the same field is closed as explained once D5 sees the unit change', async () => {
    const s = buildServices();
    const ingest = memoryIngest();
    for (let i = 0; i < 6; i++) for (const fp of await capture(s, '/payments/pay_1', 20, { service: 'payments', at: NOW - 15 * 60_000 + i * 5000 })) await ingest.add('dev', fp);
    await toggle(s, 'payments-paise');
    for (const fp of await capture(s, '/payments/pay_1', 40, { service: 'payments', at: NOW - 20_000 })) await ingest.add('dev', fp);
    const e = new DriftEngine(ingest, async () => []);
    // as in the live run: D6 fired while the window was still half old, half new
    const d6 = { id: 'drift-d6', service: 'payments', endpoint: 'GET /payments/{id}', field: 'amount', detector: 'D6', title: 'Value distribution changed: amount', severity: 'warning' as const, state: 'suspected' as const, confidence: 0.7, detectedAt: new Date(NOW - 10_000).toISOString(), before: null, after: null, usages: [] };
    (e as unknown as { events: Map<string, unknown> }).events.set('payments|GET|/payments/{id}|D6|amount', { event: d6, runs: 2, lastSeen: NOW - 5000 });
    const changed = await e.run(NOW);
    expect(e.list().some((x) => x.detector === 'D5')).toBe(true);
    const closed = e.list().find((x) => x.id === 'drift-d6')!;
    expect(closed.state).toBe('resolved');
    expect(closed.title).toBe('Value distribution changed: amount (explained: unit change)');
    expect(changed.map((c) => c.id)).toContain('drift-d6');
  });
});

describe('a confirmed change whose severity dropped while the provider reverted (found by the pipeline run)', () => {
  it('still resolves once the provider has gone back to normal', async () => {
    const s = buildServices();
    const ingest = memoryIngest();
    const feed = async (at: number, n = 3) => { for (let i = 0; i < n; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: at + i * 5000 })) await ingest.add('dev', fp); };
    await feed(NOW - 15 * 60_000, 6);
    await toggle(s, 'users-rename'); await feed(NOW - 30_000);
    const e = new DriftEngine(ingest, async () => []);   // nobody reads the field: the rename is only "normal" (info)
    await e.run(NOW); await e.run(NOW + 5000);
    const ev = e.list().find((x) => x.detector === 'D3')!;
    expect(ev.state).toBe('normal');
    await toggle(s, 'users-rename', false);
    const back = NOW + 20 * 60_000;
    await feed(back - 30_000);
    for (let i = 0; i < 3; i++) await e.run(back + i * 1000);
    expect(e.list().find((x) => x.id === ev.id)!.state).toBe('resolved');
  });
});

describe('detection reads only new fingerprints each pass (found on Render free: re-reading 24 h starved the CPU)', () => {
  it('the first pass reads the baseline period, later passes only the last 10 minutes; results are the same', async () => {
    const s = buildServices();
    const ingest = memoryIngest();
    for (let i = 0; i < 6; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: NOW - 15 * 60_000 + i * 5000 })) await ingest.add('dev', fp);
    await toggle(s, 'users-rename');
    for (let i = 0; i < 3; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: NOW - 30_000 + i * 5000 })) await ingest.add('dev', fp);
    const asked: number[] = [];
    const spy = { ...ingest, since: (p: string, ms: number) => { asked.push(ms); return ingest.since(p, ms); } };
    const e = new DriftEngine(spy, async () => [codeMap([{ field: 'name', usage: 'display' }])]);
    await e.run(NOW); await e.run(NOW + 5000);
    expect(asked[0]).toBe(NOW - 24 * 3600_000);
    expect(asked[1]).toBe(NOW - 10 * 60_000);
    expect(e.list().find((x) => x.detector === 'D3')?.state).toBe('breaking');
  });
});

describe('a restart keeps the periods of reverted changes out of the baseline (found on Render free)', () => {
  it('rename, revert, RESTART, rename again: the new engine still flags it', async () => {
    const { memoryEvents } = await import('../src/event-store.js');
    const s = buildServices();
    const ingest = memoryIngest();
    const store = memoryEvents();
    const feed = async (at: number, n = 3) => { for (let i = 0; i < n; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: at + i * 5000 })) await ingest.add('dev', fp); };
    const maps = async () => [codeMap([{ field: 'name', usage: 'display' }])];
    await feed(NOW - 15 * 60_000, 6);
    // a long rename (6 windows): without its quarantine it would be ~half of the baseline
    await toggle(s, 'users-rename'); await feed(NOW - 30_000, 6);
    const first = new DriftEngine(ingest, maps, undefined, undefined, store);
    await first.run(NOW + 5000); await first.run(NOW + 10_000);
    await toggle(s, 'users-rename', false);
    const back = NOW + 5 * 60_000;
    await feed(back - 30_000);
    for (let i = 0; i < 3; i++) await first.run(back + i * 1000);
    expect(first.list().find((x) => x.detector === 'D3')!.state).toBe('resolved');
    // restart: a new engine on the same stores
    const second = new DriftEngine(ingest, maps, undefined, undefined, store);
    await toggle(s, 'users-rename');
    const again = NOW + 10 * 60_000;
    await feed(again - 30_000);
    await second.run(again); await second.run(again + 5000);
    const d3 = second.list().filter((x) => x.detector === 'D3');
    expect(d3.some((x) => x.state === 'breaking')).toBe(true);
  });
});

describe('a different change to a field whose earlier change was fixed (found recording the demo)', () => {
  it('name -> display_name fixed (resolved by a fix); later name -> full_name is a NEW change with its own event', async () => {
    const s = buildServices();
    const ingest = memoryIngest();
    const feed = async (at: number, n = 3) => { for (let i = 0; i < n; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: at + i * 5000 })) await ingest.add('dev', fp); };
    await feed(NOW - 15 * 60_000, 6);
    await toggle(s, 'users-rename'); await feed(NOW - 30_000);
    const e = new DriftEngine(ingest, async () => [codeMap([{ field: 'name', usage: 'display' }])]);
    await e.run(NOW); await e.run(NOW + 5000);
    const first = e.list().find((x) => x.detector === 'D3')!;
    // as after a merged fix PR
    const t = [...(e as unknown as { events: Map<string, { event: { id: string; state: string }; resolvedBy?: string }> }).events.values()].find((x) => x.event.id === first.id)!;
    t.event = { ...t.event, state: 'resolved' }; t.resolvedBy = 'fix';
    // the provider goes back, then renames the same field to something else
    await toggle(s, 'users-rename', false);
    await feed(NOW + 5 * 60_000 - 30_000);
    for (let i = 0; i < 3; i++) await e.run(NOW + 5 * 60_000 + i * 1000);
    await s.inject({ method: 'POST', url: '/admin/custom', headers: { 'x-admin-token': 'dev-admin' }, payload: { service: 'users', kind: 'rename', field: 'name', to: 'full_name' } });
    const later = NOW + 10 * 60_000;
    await feed(later - 30_000);
    await e.run(later); await e.run(later + 5000);
    const second = e.list().find((x) => x.detector === 'D3' && x.title.includes('full_name'))!;
    expect(second).toBeDefined();
    expect(second.id).not.toBe(first.id);
    expect(second.state).toBe('breaking');
  });
});
