import { describe, expect, it } from 'vitest';
import { Graph, Overview } from '@seismo/contracts';
import { buildApp } from './app.js';

describe('backend skeleton', () => {
  const app = buildApp();
  it('health', async () => expect((await app.inject('/health')).json()).toEqual({ ok: true }));
  it('graph matches contract', async () => Graph.parse((await app.inject('/v1/graph')).json()));
  it('overview matches contract', async () => Overview.parse((await app.inject('/v1/overview')).json()));
  it('ingest rejects a bad key', async () => expect((await app.inject({ method: 'POST', url: '/v1/ingest', payload: {} })).statusCode).toBe(401));
});

describe('auth (P0.11)', () => {
  it('requires a valid token when AUTH_SECRET is set', async () => {
    process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret';
    const { signUserToken } = await import('./auth.js');
    const app2 = buildApp();
    expect((await app2.inject('/v1/me')).statusCode).toBe(401);
    const token = await signUserToken('octocat');
    const res = await app2.inject({ url: '/v1/me', headers: { authorization: `Bearer ${token}` } });
    expect(res.json().login).toBe('octocat');
    const sse = await signUserToken('octocat', '60s', 'sse');
    expect((await app2.inject(`/v1/events?token=${token}`)).statusCode).toBe(401); // api token is not an sse token
    expect(sse.length).toBeGreaterThan(10);
    delete process.env.AUTH_SECRET;
  });
});

describe('graph from code maps (P2.5)', () => {
  const map = {
    repo: 'demo/shop', commit: 'c', scannedAt: '2026-10-12T10:00:00.000Z',
    callSites: [{ id: 'cs1', repo: 'demo/shop', file: 'lib/pay.ts', line: 5, service: 'payments', method: 'POST', endpoint: '/payments' }, { id: 'cs2', repo: 'demo/shop', file: 'lib/x.ts', line: 9, service: 'x', method: 'GET', endpoint: '(unresolved)', unresolved: true }],
    fieldReads: [{ callSiteId: 'cs1', field: 'amount', file: 'app/checkout/page.tsx', line: 12, usage: 'arithmetic', money: true }],
    workflows: [{ id: 'checkout', name: 'checkout', file: 'app/checkout/**', functions: [], globs: ['app/checkout/**'] }],
  };
  it('stores a scan, builds the graph, traces impact to the workflow, reports coverage', async () => {
    const a = buildApp();
    const bad = await a.inject({ method: 'POST', url: '/internal/codemap', payload: map });
    expect(bad.statusCode).toBe(401);
    const ok = await a.inject({ method: 'POST', url: '/internal/codemap', headers: { 'x-internal-token': 'dev-internal' }, payload: map });
    expect(ok.statusCode).toBe(200);
    const g = Graph.parse((await a.inject('/v1/graph')).json());
    expect(g.nodes.map((n) => n.type).sort()).toContain('workflow');
    const field = g.nodes.find((n) => n.type === 'field')!;
    const imp = Graph.parse((await a.inject(`/v1/graph/impact?node=${encodeURIComponent(field.id)}`)).json());
    expect(imp.nodes.map((n) => n.id)).toContain('wf:checkout');
    expect(imp.nodes.some((n) => n.type === 'service')).toBe(true);
    const cov = (await a.inject('/v1/coverage')).json();
    expect(cov.unresolvedCalls).toBe(1);
    expect(cov.fieldsMapped).toBe(1);
  });
});
