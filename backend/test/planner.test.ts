import { describe, expect, it } from 'vitest';
import type { Fingerprint } from '@seismo/contracts';
import { buildServices } from '../../services/src/app.js';
import { buildBaselines } from '../src/baseline.js';
import { runDetectors } from '../src/detectors/index.js';
import { pathFor, planAlias } from '../src/planner.js';
import { capture, toggle } from './helpers.js';

const T0 = Date.parse('2026-10-14T10:00:00Z');
async function renameCase() {
  const s = buildServices();
  const base: Fingerprint[] = [];
  for (let i = 0; i < 3; i++) base.push(...(await capture(s, '/users/u_1', 40, { service: 'users', at: T0 + i * 5000 })));
  await toggle(s, 'users-rename');
  const win = await capture(s, '/users/u_1', 40, { service: 'users', at: T0 + 600_000 });
  const b = buildBaselines(base)[0]!, w = buildBaselines(win)[0]!;
  return { b, w, finding: runDetectors(b, w).find((f) => f.detector === 'D3')! };
}
const input = async (over: Partial<Parameters<typeof planAlias>[0]> = {}) => {
  const { b, w, finding } = await renameCase();
  return { finding, base: b, win: w, maps: [], existingRules: [], eventId: 'drift-abc123', today: '2026-10-18', ...over };
};

describe('alias planner C1-C6 (P5.4)', () => {
  it('rename passes every check and yields the exact rule', async () => {
    const p = planAlias(await input());
    expect(p.checks.map((c) => c.id)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6']);
    expect(p.ok).toBe(true);
    expect(p.rule).toEqual({ id: 'a-abc123', kind: 'alias', endpoint: 'GET /users/{id}', path: '$', target: 'name', source: 'display_name', driftEvent: 'drift-abc123', addedAt: '2026-10-18' });
  });
  it('C1 blocks unsafe names', async () => {
    const i = await input();
    i.finding = { ...i.finding, rename: { ...i.finding.rename!, from: '__proto__' } };
    const p = planAlias(i);
    expect(p.ok).toBe(false);
    expect(p.checks.find((c) => c.id === 'C1')!.passed).toBe(false);
  });
  it('C2 blocks when the old field is still being sent', async () => {
    const i = await input();
    i.win.fields['name'] = { ...i.base.fields['name']! };
    expect(planAlias(i).checks.find((c) => c.id === 'C2')!.passed).toBe(false);
  });
  it('C3 blocks a type/format mismatch', async () => {
    const i = await input();
    i.win.fields['display_name'] = { ...i.win.fields['display_name']!, types: { number: 40 }, fmt: {} };
    expect(planAlias(i).checks.find((c) => c.id === 'C3')!.passed).toBe(false);
  });
  it('C4 blocks weak value similarity', async () => {
    const i = await input();
    i.finding = { ...i.finding, rename: { ...i.finding.rename!, valueSimilarity: 0.1 } };
    expect(planAlias(i).checks.find((c) => c.id === 'C4')!.passed).toBe(false);
  });
  it('C5 blocks when code already reads the new name or a rule already targets the key', async () => {
    const i = await input();
    const maps = [{ repo: 'r', commit: 'c', scannedAt: '2026-10-14T10:00:00.000Z', workflows: [], callSites: [{ id: 'c1', repo: 'r', file: 'a.ts', line: 1, service: 'users', method: 'GET', endpoint: '/users/{param}' }], fieldReads: [{ callSiteId: 'c1', field: 'display_name', file: 'a.ts', line: 9, usage: 'display' as const, money: false }] }];
    expect(planAlias({ ...i, maps }).checks.find((c) => c.id === 'C5')!.passed).toBe(false);
    const existing = [{ kind: 'alias' as const, endpoint: 'GET /users/{id}', path: '$', target: 'name', source: 'other' }];
    expect(planAlias({ ...i, existingRules: existing }).checks.find((c) => c.id === 'C5')!.passed).toBe(false);
  });
  it('C6 blocks ambiguous candidates', async () => {
    const i = await input();
    i.finding = { ...i.finding, rename: { ...i.finding.rename!, margin: 0.05 } };
    const p = planAlias(i);
    expect(p.checks.find((c) => c.id === 'C6')!.passed).toBe(false);
    expect(p.ok).toBe(false);
    expect(p.rule).toBeUndefined();
  });
  it('anything but a rename never gets an automatic PR (paise, type change, enum...)', async () => {
    const i = await input();
    for (const d of ['D4', 'D5', 'D7', 'D9', 'D13']) expect(planAlias({ ...i, finding: { ...i.finding, detector: d, rename: undefined } }).ok).toBe(false);
  });
  it('rule paths for nested fields', () => {
    expect(pathFor('name')).toBe('$');
    expect(pathFor('customer.name')).toBe('$.customer');
    expect(pathFor('data[].user.name')).toBe('$.data[*].user');
  });
});
