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
