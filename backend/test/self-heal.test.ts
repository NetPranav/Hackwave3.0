import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { DriftEngine } from '../src/drift-engine.js';
import { memoryIngest } from '../src/ingest-store.js';
import { memorySettings, DEFAULT_SETTINGS } from '../src/settings-store.js';

const H = { 'x-seismo-key': 'dev-key' };
function setup(autoHeal: boolean) {
  const ingest = memoryIngest();
  const engine = new DriftEngine(ingest, async () => []);
  const ev = { id: 'drift-r1', service: 'users', endpoint: 'GET /users/{id}', field: 'name', detector: 'D3', title: 'Field renamed: name → full_name', severity: 'breaking' as const, state: 'fix_pending' as const, confidence: 0.95, detectedAt: new Date().toISOString(), before: null, after: null, usages: [],
    fix: { rung: 'alias' as const, rule: { id: 'a-r1', kind: 'alias' as const, endpoint: 'GET /users/{id}', path: '$', target: 'name', source: 'full_name' }, validation: { driftId: 'drift-r1', checks: [{ id: 'C1' as const, passed: true }, { id: 'C9' as const, passed: true }], ci: 'pending' as const, prUrl: 'https://github.com/o/r/pull/1' } } };
  (engine as unknown as { events: Map<string, unknown>; ready: Promise<void> }).events.set('k', { event: ev, runs: 2, lastSeen: Date.now() });
  const settings = memorySettings();
  void settings.put({ ...DEFAULT_SETTINGS, autoHeal });
  return { app: buildApp({ engine, ingest, settings }), engine };
}

describe('self-healing renames (v3-P2)', () => {
  it('auto-heal off: no live rules', async () => {
    const { app } = setup(false);
    expect((await app.inject({ url: '/v1/sdk/rules', headers: H })).json()).toEqual({ rules: [] });
  });
  it('auto-heal on: the PR-checked rename is served live (ETag/304), wrong key refused', async () => {
    const { app } = setup(true);
    expect((await app.inject('/v1/sdk/rules')).statusCode).toBe(401);
    const r = await app.inject({ url: '/v1/sdk/rules', headers: H });
    expect(r.json().rules).toEqual([{ id: 'a-r1', kind: 'alias', endpoint: 'GET /users/{id}', path: '$', target: 'name', source: 'full_name' }]);
    expect((await app.inject({ url: '/v1/sdk/rules', headers: { ...H, 'if-none-match': r.headers.etag as string } })).statusCode).toBe(304);
  });
  it('healed responses reported by the SDK show on the change and in the live feed', async () => {
    const { app } = setup(true);
    await app.inject({ method: 'POST', url: '/v1/sdk/rule-hits', headers: { ...H, 'content-type': 'application/json' }, payload: JSON.stringify({ hits: { 'a-r1': 7 } }) });
    const ev = (await app.inject('/v1/drift-events')).json()[0];
    expect(ev.heal).toMatchObject({ live: true, hits: 7 });
    const act = (await app.inject('/v1/activity')).json() as { text: string }[];
    expect(act[0]!.text).toContain('Healed live in the app: 7 response(s)');
  });
  it('a resent fingerprint (same batchId) is stored once', async () => {
    const ingest = memoryIngest();
    const app = buildApp({ ingest });
    const fp = { v: 1, batchId: 'b-123456789', service: 's', method: 'GET', endpoint: '/a', windowStart: new Date().toISOString(), windowSeconds: 5, count: 1, statusCounts: { '200': 1 }, latencyMs: { p50: 1, p95: 1 }, headers: {}, reqQueryKeys: [], shapeHash: 'x', fields: {} };
    for (let i = 0; i < 3; i++) expect((await app.inject({ method: 'POST', url: '/v1/ingest', headers: { ...H, 'content-type': 'application/json' }, payload: JSON.stringify(fp) })).statusCode).toBe(200);
    expect(await ingest.since('dev', 0)).toHaveLength(1);
  });
});
