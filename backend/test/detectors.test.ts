import { describe, expect, it } from 'vitest';
import type { Fingerprint } from '@seismo/contracts';
import { buildServices } from '../../services/src/app.js';
import { buildBaselines } from '../src/baseline.js';
import { runDetectors, runStatusMixDetectors } from '../src/detectors/index.js';
import { capture, toggle } from './helpers.js';

const T0 = Date.parse('2026-10-14T10:00:00Z');
/** v1 baseline (n responses) vs v2 window (n responses) for one endpoint, with `scenario` toggled for the window. */
async function flip(scenario: string, path: string, service: string, opts: { method?: 'GET' | 'POST'; n?: number } = {}) {
  const s = buildServices();
  const n = opts.n ?? 120;
  const base: Fingerprint[] = [];
  const idPath = path;
  for (let i = 0; i < 3; i++) base.push(...(await capture(s, idPath, n / 3, { service, method: opts.method, at: T0 + i * 5000 })));
  await toggle(s, scenario);
  const win = await capture(s, idPath, n / 3, { service, method: opts.method, at: T0 + 600_000 });
  const find = (fps: Fingerprint[], cls: string) => buildBaselines(fps.filter((f) => f.statusClass === cls))[0];
  return { base, win, find };
}
const detect = async (...a: Parameters<typeof flip>) => {
  const { base, win, find } = await flip(...a);
  const b = find(base, '2xx')!, w = find(win, '2xx')!;
  return runDetectors(b, w);
};

describe('detectors on real v1 -> v2 fake-service traffic', () => {
  it('D3 rename: users name -> display_name (alias rung)', async () => {
    const f = await detect('users-rename', '/users/u_1', 'users');
    const r = f.find((x) => x.detector === 'D3')!;
    expect(r.rename).toMatchObject({ from: 'name', to: 'display_name' });
    expect(r.rename!.margin).toBeGreaterThanOrEqual(0);
    expect(r.rung).toBe('alias');
    expect(r.confidence).toBeGreaterThanOrEqual(0.75);
    expect(f.some((x) => x.detector === 'D1' && x.field === 'name')).toBe(false); // explained by the rename
  });
  it('D3 rename still found when a few v2 responses leaked into the baseline (reset racing in-flight batches)', async () => {
    const s = buildServices();
    const base: Fingerprint[] = [];
    await toggle(s, 'users-rename');
    base.push(...(await capture(s, '/users/u_1', 2, { service: 'users', at: T0 - 5000 })));   // 2 stray v2 responses
    await toggle(s, 'users-rename', false);                                                       // back to v1
    for (let i = 0; i < 3; i++) base.push(...(await capture(s, '/users/u_1', 40, { service: 'users', at: T0 + i * 5000 })));
    await toggle(s, 'users-rename');
    const win = await capture(s, '/users/u_1', 40, { service: 'users', at: T0 + 600_000 });
    const b = buildBaselines(base)[0]!, w = buildBaselines(win)[0]!;
    expect(b.fields['display_name']!.presence).toBeGreaterThan(0);
    expect(runDetectors(b, w).find((x) => x.detector === 'D3')?.rename).toMatchObject({ from: 'name', to: 'display_name' });
  });
  it('D4 type change: payments amount number -> string', async () => {
    const f = await detect('payments-amount-type', '/payments/pay_1', 'payments');
    expect(f.find((x) => x.detector === 'D4' && x.field === 'amount')).toBeTruthy();
  });
  it('D13 deprecation: shipping Sunset header', async () => {
    const f = await detect('shipping-deprecation', '/shipments/sh_1', 'shipping');
    expect(f.find((x) => x.detector === 'D13')!.title).toContain('Sunset');
  });
  it('D11 error shape: users 404 body {error} -> {errors:[]}', async () => {
    const s = buildServices();
    const base = await capture(s, '/users/missing', 60, { service: 'users', at: T0 });
    await toggle(s, 'users-error-shape');
    const win = await capture(s, '/users/missing', 30, { service: 'users', at: T0 + 600_000 });
    const b = buildBaselines(base)[0]!, w = buildBaselines(win)[0]!;
    expect(b.statusClass).toBe('4xx');
    expect(runDetectors(b, w).find((x) => x.detector === 'D11')).toBeTruthy();
  });
  it('D17 gone: healthy endpoint starts returning 404 (all-class profiles)', async () => {
    const s = buildServices();
    const base = await capture(s, '/users/u_1', 60, { service: 'users', at: T0 });
    const win = await capture(s, '/users/u_404', 30, { service: 'users', at: T0 + 600_000 });
    expect(runDetectors(buildBaselines(base)[0]!, buildBaselines(win)[0]!).find((x) => x.detector === 'D17')).toBeUndefined(); // per class it cannot see it
    const f = runStatusMixDetectors(buildBaselines(base, T0, true)[0]!, buildBaselines(win, T0, true)[0]!);
    expect(f.find((x) => x.detector === 'D17')).toBeTruthy();
  });
  it('D12: 429s suddenly common (all-class profiles)', async () => {
    const b = buildBaselines([{ v: 1, service: 's', method: 'GET', endpoint: '/x', statusClass: '2xx', windowStart: new Date(T0).toISOString(), windowSeconds: 5, count: 100, statusCounts: { '200': 100 }, latencyMs: { p50: 1, p95: 2 }, headers: {}, reqQueryKeys: [], shapeHash: 'a', fields: {} }], T0, true)[0]!;
    const w = buildBaselines([
      { v: 1, service: 's', method: 'GET', endpoint: '/x', statusClass: '2xx', windowStart: new Date(T0).toISOString(), windowSeconds: 5, count: 70, statusCounts: { '200': 70 }, latencyMs: { p50: 1, p95: 2 }, headers: {}, reqQueryKeys: [], shapeHash: 'a', fields: {} },
      { v: 1, service: 's', method: 'GET', endpoint: '/x', statusClass: '4xx', windowStart: new Date(T0).toISOString(), windowSeconds: 5, count: 30, statusCounts: { '429': 30 }, latencyMs: { p50: 1, p95: 2 }, headers: {}, reqQueryKeys: [], shapeHash: 'b', fields: {} },
    ], T0, true)[0]!;
    expect(runStatusMixDetectors(b, w).find((x) => x.detector === 'D12')).toBeTruthy();
  });
  it('orders limit cap shows up as array length drop (reqLimit 500, max length 100)', async () => {
    const s = buildServices();
    const base = await capture(s, '/orders?limit=500', 3, { service: 'orders', at: T0 });
    await toggle(s, 'orders-limit-cap');
    const win = await capture(s, '/orders?limit=500', 3, { service: 'orders', at: T0 + 600_000 });
    expect(base[0]!.fields['data']!.arrayLen!.max).toBe(500);
    expect(win[0]!.fields['data']!.arrayLen!.max).toBe(100);
    expect(win[0]!.reqLimit).toBe(500);
  });
  it('P4.9 soak: identical v1 traffic in baseline and window -> no findings', async () => {
    const s = buildServices();
    const base: Fingerprint[] = [], win: Fingerprint[] = [];
    for (const [p, svc] of [['/users/u_1', 'users'], ['/payments/pay_1', 'payments'], ['/shipments/sh_1', 'shipping'], ['/orders?limit=20', 'orders']] as const) {
      for (let i = 0; i < 4; i++) base.push(...(await capture(s, p, 30, { service: svc, at: T0 + i * 5000 })));
      win.push(...(await capture(s, p, 30, { service: svc, at: T0 + 600_000 })));
    }
    for (const w of buildBaselines(win)) {
      const b = buildBaselines(base).find((x) => x.service === w.service && x.endpoint === w.endpoint)!;
      expect(runDetectors(b, w), `${w.service} ${w.endpoint}`).toEqual([]);
    }
  });
});
