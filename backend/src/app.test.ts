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
