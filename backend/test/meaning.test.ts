import { describe, expect, it } from 'vitest';
import type { Fingerprint } from '@seismo/contracts';
import { buildServices } from '../../services/src/app.js';
import { buildBaselines } from '../src/baseline.js';
import { DEFAULT_CTX, runDetectors } from '../src/detectors/index.js';
import { d6ValueDrift } from '../src/detectors/meaning.js';
import { capture, toggle } from './helpers.js';

const T0 = Date.parse('2026-10-14T10:00:00Z');
const CTX = { ...DEFAULT_CTX, minEnumSamples: 50 };

async function flip(scenario: string | null, path: string, service: string, n = 60) {
  const s = buildServices();
  const base: Fingerprint[] = [];
  for (let i = 0; i < 3; i++) base.push(...(await capture(s, path, n, { service, at: T0 + i * 5000 })));
  if (scenario) await toggle(s, scenario);
  const win = await capture(s, path, n, { service, at: T0 + 600_000 });
  return runDetectors(buildBaselines(base.filter((f) => f.statusClass === '2xx'))[0]!, buildBaselines(win.filter((f) => f.statusClass === '2xx'))[0]!, CTX);
}

describe('P6 meaning detectors on real fake-service traffic', () => {
  it('D5 unit change: payments amount rupees -> paise is x100, nothing else', async () => {
    const f = await flip('payments-paise', '/payments/pay_1', 'payments');
    const d5 = f.find((x) => x.detector === 'D5')!;
    expect(d5.field).toBe('amount');
    expect(d5.title).toBe('Unit change: amount ×100');
    expect(d5.rung).toBe('review');
    expect(f.some((x) => x.detector === 'D6')).toBe(false);          // explained by D5, not double-reported
    expect(f.some((x) => x.detector === 'D4')).toBe(false);          // still an integer
  });
  it('D7 new enum value: shipping partially_shipped (allow-listed label shown), in_transit vanished', async () => {
    const f = await flip('shipping-enum', '/shipments/sh_1', 'shipping');
    const d7 = f.find((x) => x.detector === 'D7')!;
    expect(d7.field).toBe('status');
    expect(d7.title).toBe('New status value: partially_shipped');
    expect(JSON.stringify(d7.evidence)).toContain('in_transit');
    expect(f.some((x) => x.detector === 'D8')).toBe(false);          // reported together with D7
  });
  it('D9 silent truncation: orders asked 500, got exactly 100 in every call', async () => {
    const f = await flip('orders-limit-cap', '/orders?limit=500', 'orders', 6);
    const d9 = f.find((x) => x.detector === 'D9')!;
    expect(d9.field).toBe('data');
    expect(d9.title).toBe('Silent truncation: asked 500, got exactly 100 in 100% of calls');
    expect(d9.confidence).toBeGreaterThanOrEqual(0.9);
  });
  it('D10 pagination: page -> cursor', async () => {
    const f = await flip('orders-cursor', '/orders?limit=20', 'orders', 30);
    const d10 = f.find((x) => x.detector === 'D10')!;
    expect(d10.title).toContain('next_cursor');
    expect(d10.title).toContain('page');
  });
  it('soak with low enum threshold: identical v1 traffic -> no meaning findings', async () => {
    for (const [p, svc] of [['/payments/pay_1', 'payments'], ['/shipments/sh_1', 'shipping'], ['/orders?limit=500', 'orders'], ['/users/u_1', 'users']] as const) {
      expect(await flip(null, p, svc, 60), p).toEqual([]);
    }
  });
  it('a type change is not misread as a unit change', async () => {
    const f = await flip('payments-amount-type', '/payments/pay_1', 'payments');
    expect(f.some((x) => x.detector === 'D5')).toBe(false);
    expect(f.some((x) => x.detector === 'D4')).toBe(true);
  });
  it('D6 value drift when the shift is not a clean unit factor', () => {
    const mk = (mag: Record<string, number>, numP50: number) => ({ service: 's', method: 'GET', endpoint: '/x', statusClass: '2xx', samples: 100, firstSeen: 0, ready: true, latencyP95: 1, statusCounts: {}, shapes: [], headers: {}, reqQueryKeys: [], fields: { price: { n: 100, presence: 1, types: { integer: 100 }, fmt: {}, nullRate: 0, enumValues: {}, hashes: {}, mag, numP50 } } });
    const f = d6ValueDrift(mk({ '2': 100 }, 300), mk({ '2': 100 }, 650), CTX, new Set());
    expect(f[0]?.detector).toBe('D6');
    expect(d6ValueDrift(mk({ '2': 100 }, 300), mk({ '2': 100 }, 320), CTX, new Set())).toEqual([]);
  });
});
