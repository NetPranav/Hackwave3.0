import Fastify from 'fastify';
import cors from '@fastify/cors';
import { requireUser, signUserToken, userFrom } from './auth.js';
import {
  mockDrift, mockGraph, mockMe, mockNotificationSettings, mockOverview, mockRadar, mockReview, mockStatus,
  CodeMap, Fingerprint, NotificationSettings,
} from '@seismo/contracts';
import { buildGraph, coverage, impact } from './graph.js';
import { memoryStore, type CodeMapStore } from './codemap-store.js';

/** P0.4 skeleton: routes return contract-shaped mock data until the real engine (P2-P6) replaces each one. */
export function buildApp(opts: { store?: CodeMapStore } = {}) {
  const store = opts.store ?? memoryStore();
  const sseClients = new Set<(event: string, data: unknown) => void>();
  const app = Fastify({ logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' } });
  app.register(cors, { origin: true });

  const ingestKeys = new Set((process.env.SEISMO_SDK_KEYS ?? 'dev-key').split(','));
  let notif = mockNotificationSettings();

  // Every /v1 route except SDK ingest and SSE is user-scoped (P0.11).
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/v1/') && !req.url.startsWith('/v1/ingest') && !req.url.startsWith('/v1/events')) return requireUser(req, reply);
  });

  app.get('/health', async () => ({ ok: true }));
  app.get('/ready', async () => ({ ok: true }));

  app.get('/v1/me', async (req) => ({ ...mockMe(), login: req.user ?? 'demo-user' }));
  app.post('/v1/events/token', async (req) => {
    if (!process.env.AUTH_SECRET) return { token: 'dev' };
    return { token: await signUserToken(req.user!, '60s', 'sse') };
  });
  app.get('/v1/overview', async () => mockOverview());
  // Graph from real code maps; mock data until the first scan has been stored (so the dashboard always has something to draw).
  app.get('/v1/graph', async () => {
    const maps = await store.all();
    return maps.length ? buildGraph({ maps }).dto : mockGraph();
  });
  app.get('/v1/graph/impact', async (req) => {
    const maps = await store.all();
    const { node } = req.query as { node?: string };
    if (!maps.length) return mockGraph();
    return impact(buildGraph({ maps }).g, node ?? '');
  });
  // The GitHub App posts finished scans here (service-to-service, shared secret).
  app.post('/internal/codemap', async (req, reply) => {
    if (req.headers['x-internal-token'] !== (process.env.INTERNAL_TOKEN ?? 'dev-internal')) return reply.code(401).send({ error: 'unauthorized' });
    const parsed = CodeMap.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_codemap', message: parsed.error.message });
    await store.put(parsed.data);
    for (const send of sseClients) send('graph.updated', { repo: parsed.data.repo });
    return { ok: true };
  });
  app.get('/v1/installations', async () => {
    const maps = await store.all();
    if (!maps.length) return [{ id: 'inst-1', account: 'demo', repos: [{ name: 'seismo-demo-shop', scan: 'done', progress: 1 }] }];
    const byOwner = new Map<string, string[]>();
    for (const m of maps) { const [o, r] = m.repo.split('/') as [string, string]; byOwner.set(o, [...(byOwner.get(o) ?? []), r]); }
    return [...byOwner].map(([account, repos]) => ({ id: `inst-${account}`, account, repos: repos.map((name) => ({ name, scan: 'done' as const, progress: 1 })) }));
  });
  app.get('/v1/coverage', async () => {
    const maps = await store.all();
    return maps.length ? coverage(maps) : { endpointsMapped: 8, endpointsSeen: 9, fieldsMapped: 41, fieldsSeen: 50 };
  });
  app.get('/v1/status', async () => ({ services: mockStatus() }));
  app.get('/v1/drift-events', async () => mockDrift());
  app.get('/v1/radar', async () => mockRadar());
  app.get('/v1/review', async () => mockReview());
  app.post('/v1/review', async () => ({ ok: true }));
  app.get('/v1/settings/notifications', async () => notif);
  app.put('/v1/settings/notifications', async (req) => { notif = NotificationSettings.parse(req.body); return notif; });
  app.post('/v1/notifications/test', async () => ({ ok: true }));

  app.post('/v1/ingest', async (req, reply) => {
    const key = String(req.headers['x-seismo-key'] ?? '');
    if (!ingestKeys.has(key)) return reply.code(401).send({ error: 'bad_key' });
    const parsed = Fingerprint.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_fingerprint', message: parsed.error.message });
    return { ok: true };
  });

  // SSE stub (P0.4). Real events arrive with P2/P4.
  app.get('/v1/events', async (req, reply) => {
    if (!(await userFrom(req, 'sse'))) return reply.code(401).send({ error: 'unauthorized' });
    reply.raw.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'access-control-allow-origin': '*' });
    reply.raw.write('event: hello\ndata: {}\n\n');
    const send = (event: string, data: unknown) => reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    sseClients.add(send);
    const t = setInterval(() => reply.raw.write(': ping\n\n'), 15000);
    req.raw.on('close', () => { clearInterval(t); sseClients.delete(send); });
  });
  return app;
}
