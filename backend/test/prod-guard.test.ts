import { describe, expect, it } from 'vitest';
import { productionProblems } from '../src/prod-guard.js';
import { memoryIngest } from '../src/ingest-store.js';

describe('production guard and retention (v3-P0.3/P0.4)', () => {
  it('only in production: default or short secrets are refused', () => {
    expect(productionProblems({ NODE_ENV: 'development' })).toEqual([]);
    expect(productionProblems({ NODE_ENV: 'production', INTERNAL_TOKEN: 'dev-internal', DEMO_ADMIN_TOKEN: 'x'.repeat(32), AUTH_SECRET: 'y'.repeat(32) })).toEqual(['INTERNAL_TOKEN must be set to a random secret of at least 16 characters']);
    expect(productionProblems({ NODE_ENV: 'production', INTERNAL_TOKEN: 'a'.repeat(32), DEMO_ADMIN_TOKEN: 'b'.repeat(32), AUTH_SECRET: 'c'.repeat(32) })).toEqual([]);
  });
  it('retention deletes only fingerprints older than the cut', async () => {
    const s = memoryIngest();
    const fp = (iso: string) => ({ v: 1, service: 's', method: 'GET', endpoint: '/a', windowStart: iso, windowSeconds: 5, count: 1, statusCounts: { '200': 1 }, latencyMs: { p50: 1, p95: 1 }, headers: {}, reqQueryKeys: [], shapeHash: 'x', fields: {} }) as never;
    await s.add('dev', fp('2026-10-10T00:00:00Z'));
    await s.add('dev', fp('2026-10-11T12:00:00Z'));
    expect(await s.prune(Date.parse('2026-10-11T00:00:00Z'))).toBe(1);
    expect(await s.since('dev', 0)).toHaveLength(1);
  });
});

describe('one public service: forwarding (v3-P0.5)', () => {
  it('forwards /providers/* (prefix stripped) and /api/github/* (raw body, signature header intact)', async () => {
    const http = await import('node:http');
    const seen: { url?: string; body?: string; sig?: string }[] = [];
    const upstream = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { seen.push({ url: req.url, body: b, sig: req.headers['x-hub-signature-256'] as string }); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); }); }).listen(0);
    const port = (upstream.address() as { port: number }).port;
    process.env.PROVIDERS_INTERNAL_URL = `http://127.0.0.1:${port}`;
    process.env.GITHUB_APP_INTERNAL_URL = `http://127.0.0.1:${port}`;
    const { buildApp } = await import('../src/app.js');
    const a = buildApp();
    await a.listen({ port: 0 });
    const base = `http://127.0.0.1:${(a.server.address() as { port: number }).port}`;
    try {
      expect((await (await fetch(`${base}/providers/users/u_1`)).json())).toEqual({ ok: true });
      const raw = '{"action":"closed",  "spacing":"kept exactly"}';
      await fetch(`${base}/api/github/webhooks`, { method: 'POST', body: raw, headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=abc' } });
      expect(seen).toEqual([{ url: '/users/u_1', body: '', sig: undefined }, { url: '/api/github/webhooks', body: raw, sig: 'sha256=abc' }]);
    } finally {
      await a.close(); upstream.close();
      delete process.env.PROVIDERS_INTERNAL_URL; delete process.env.GITHUB_APP_INTERNAL_URL;
    }
  });
});
