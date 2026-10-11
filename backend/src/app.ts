import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  mockDrift, mockGraph, mockMe, mockNotificationSettings, mockOverview, mockRadar, mockReview, mockStatus,
  Fingerprint, NotificationSettings,
} from '@seismo/contracts';

/** P0.4 skeleton: routes return contract-shaped mock data until the real engine (P2-P6) replaces each one. */
export function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' } });
  app.register(cors, { origin: true });

  const ingestKeys = new Set((process.env.SEISMO_SDK_KEYS ?? 'dev-key').split(','));
  let notif = mockNotificationSettings();

  app.get('/health', async () => ({ ok: true }));
  app.get('/ready', async () => ({ ok: true }));

  app.get('/v1/me', async () => mockMe());
  app.get('/v1/overview', async () => mockOverview());
  app.get('/v1/graph', async () => mockGraph());
  app.get('/v1/graph/impact', async () => mockGraph());
  app.get('/v1/installations', async () => [{ id: 'inst-1', account: 'demo', repos: [{ name: 'seismo-demo-shop', scan: 'done', progress: 1 }] }]);
  app.get('/v1/coverage', async () => ({ endpointsMapped: 8, endpointsSeen: 9, fieldsMapped: 41, fieldsSeen: 50 }));
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
  app.get('/v1/events', (req, reply) => {
    reply.raw.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'access-control-allow-origin': '*' });
    reply.raw.write('event: hello\ndata: {}\n\n');
    const t = setInterval(() => reply.raw.write(': ping\n\n'), 15000);
    req.raw.on('close', () => clearInterval(t));
  });
  return app;
}
