import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { Probot, Server } from 'probot';
import app from '../src/app.js';

let server: Server;
const port = 3998;
beforeAll(async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'pkcs1', format: 'pem' } });
  server = new Server({ Probot: Probot.defaults({ appId: 1, privateKey, secret: 's', logLevel: 'silent' }), port, webhookPath: '/api/github/webhooks', log: undefined as never });
  await server.load(app);
  await server.start();
});
afterAll(async () => { await server.stop(); });

describe('internal routes (backend -> GitHub App)', () => {
  it('reject calls without the shared token', async () => {
    for (const path of ['/internal/fix', '/internal/rules']) {
      const r = await fetch(`http://localhost:${port}${path}`, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
      expect(r.status).toBe(401);
    }
  });
  it('webhook endpoint still works next to them', async () => {
    const r = await fetch(`http://localhost:${port}/api/github/webhooks`, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
    expect(r.status).toBeGreaterThanOrEqual(400);   // unsigned -> rejected by Probot, not swallowed by our handler
    expect(r.status).not.toBe(404);
  });
});
