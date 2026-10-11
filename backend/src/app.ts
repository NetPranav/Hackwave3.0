import Fastify from 'fastify';
import cors from '@fastify/cors';
import { requireUser, signUserToken, userFrom } from './auth.js';
import {
  mockDrift, mockGraph, mockMe, mockNotificationSettings, mockOverview, mockRadar, mockReview, mockStatus,
  CodeMap, Fingerprint, NotificationSettings,
} from '@seismo/contracts';
import { buildGraph, coverage, impact, statesFromEvents } from './graph.js';
import { memoryStore, type CodeMapStore } from './codemap-store.js';
import { memoryIngest, SdkKeys, type IngestStore } from './ingest-store.js';
import { buildBaselines } from './baseline.js';
import { buildStatus, providerStatus } from './status.js';
import { gunzipSync } from 'node:zlib';
import { DriftEngine, type FixDispatcher } from './drift-engine.js';
import { httpFixDispatcher } from './fix-dispatcher.js';

/**
 * Real data everywhere. Contract-shaped mock data is returned ONLY when SEISMO_MOCKS=1 (dashboard development without an engine);
 * otherwise an empty system answers with empty results, never with invented drift.
 */
export function buildApp(opts: { store?: CodeMapStore; ingest?: IngestStore; keys?: SdkKeys; engine?: DriftEngine; fixer?: FixDispatcher; mocks?: boolean } = {}) {
  const mocks = opts.mocks ?? process.env.SEISMO_MOCKS === '1';
  const store = opts.store ?? memoryStore();
  const ingestStore = opts.ingest ?? memoryIngest();
  const keys = opts.keys ?? new SdkKeys();
  const engine = opts.engine ?? new DriftEngine(ingestStore, () => store.all(), undefined, opts.fixer ?? httpFixDispatcher());
  const sseClients = new Set<(event: string, data: unknown) => void>();
  const app = Fastify({ logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' } });
  app.register(cors, { origin: true });

  let notif = mockNotificationSettings();

  // SDK batches arrive gzipped.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body: Buffer, done) => {
    try {
      const raw = req.headers['content-encoding'] === 'gzip' ? gunzipSync(body) : body;
      done(null, raw.length ? JSON.parse(raw.toString('utf8')) : {});
    } catch (e) { done(e as Error, undefined); }
  });

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
  app.get('/v1/overview', async () => {
    const fps = await ingestStore.since('dev', Date.now() - 10 * 60_000);
    const maps = await store.all();
    if (!fps.length && !maps.length && mocks) return mockOverview();
    const st = buildStatus(fps);
    const cov = coverage(maps);
    const open = engine.list().filter((e) => !['resolved', 'expected', 'snoozed'].includes(e.state));
    const count = (sev: string) => open.filter((e) => e.severity === sev).length;
    return {
      servicesMonitored: st.length, endpoints: cov.endpointsMapped, coveragePct: cov.fieldsSeen ? Math.round((100 * cov.fieldsMapped) / cov.fieldsSeen) : 0,
      openDrifts: { info: count('info'), warning: count('warning'), breaking: count('breaking') },
      fixPrsOpen: open.filter((e) => e.state === 'fix_pending').length, radarUpcoming: 0,
    };
  });
  // Graph from real code maps; mock data until the first scan has been stored (so the dashboard always has something to draw).
  app.get('/v1/graph', async () => {
    const maps = await store.all();
    if (!maps.length && mocks) return mockGraph();
    return buildGraph({ maps, states: statesFromEvents(engine.list()) }).dto;
  });
  app.get('/v1/graph/impact', async (req) => {
    const maps = await store.all();
    const { node } = req.query as { node?: string };
    if (!maps.length) return mocks ? mockGraph() : { nodes: [], links: [] };
    return impact(buildGraph({ maps, states: statesFromEvents(engine.list()) }).g, node ?? '');
  });
  // The GitHub App reports merged/closed fix PRs here (P5.9).
  app.post('/internal/fix-event', async (req, reply) => {
    if (req.headers['x-internal-token'] !== (process.env.INTERNAL_TOKEN ?? 'dev-internal')) return reply.code(401).send({ error: 'unauthorized' });
    const { ruleId, merged } = req.body as { ruleId: string; merged: boolean };
    const ev = engine.resolveByRule(ruleId, !!merged);
    if (ev) for (const send of sseClients) send('drift.updated', ev);
    return { ok: !!ev };
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
    if (!maps.length) return mocks ? [{ id: 'inst-1', account: 'demo', repos: [{ name: 'seismo-demo-shop', scan: 'done', progress: 1 }] }] : [];
    const byOwner = new Map<string, string[]>();
    for (const m of maps) { const [o, r] = m.repo.split('/') as [string, string]; byOwner.set(o, [...(byOwner.get(o) ?? []), r]); }
    return [...byOwner].map(([account, repos]) => ({ id: `inst-${account}`, account, repos: repos.map((name) => ({ name, scan: 'done' as const, progress: 1 })) }));
  });
  app.get('/v1/coverage', async () => {
    const maps = await store.all();
    return maps.length || !mocks ? coverage(maps) : { endpointsMapped: 8, endpointsSeen: 9, fieldsMapped: 41, fieldsSeen: 50 };
  });
  app.get('/v1/status', async () => {
    const fps = await ingestStore.since('dev', Date.now() - 10 * 60_000);
    if (!fps.length) return { services: mocks ? mockStatus() : [] };
    const services = [...new Set(fps.map((f) => f.service))];
    const provider = Object.fromEntries(await Promise.all(services.map(async (sv) => [sv, await providerStatus(sv)] as const)));
    return { services: buildStatus(fps, { provider, states: statesFromEvents(engine.list()) }) };
  });
  app.get('/v1/drift-events', async () => {
    const real = engine.list();
    return real.length || !mocks ? real : mockDrift();
  });
  /** One detection pass now (the server also runs it every 5 s). Emits drift.created / drift.updated over SSE. */
  app.post('/internal/detect', async (req, reply) => {
    if (req.headers['x-internal-token'] !== (process.env.INTERNAL_TOKEN ?? 'dev-internal')) return reply.code(401).send({ error: 'unauthorized' });
    const changed = await engine.run();
    for (const e of changed) for (const send of sseClients) send(e.state === 'suspected' || e.state === 'normal' ? 'drift.created' : 'drift.updated', e);
    return { changed: changed.length };
  });
  app.get('/v1/radar', async () => (mocks ? mockRadar() : []));   // radar arrives in P7
  app.get('/v1/review', async () => {
    const q = engine.reviewQueue();
    return q.length ? q.map(({ event, reason }) => ({ id: `rev-${event.id}`, drift: event, suggestion: reason, status: 'open' as const })) : mocks ? mockReview() : [];
  });
  app.post('/v1/review', async () => ({ ok: true }));
  app.get('/v1/settings/notifications', async () => notif);
  app.put('/v1/settings/notifications', async (req) => { notif = NotificationSettings.parse(req.body); return notif; });
  app.post('/v1/notifications/test', async () => ({ ok: true }));

  app.post('/v1/ingest', async (req, reply) => {
    const projectId = keys.verify(String(req.headers['x-seismo-key'] ?? ''));
    if (!projectId) return reply.code(401).send({ error: 'bad_key' });
    const parsed = Fingerprint.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_fingerprint', message: parsed.error.message });
    await ingestStore.add(projectId, parsed.data);
    for (const send of sseClients) send('status.updated', { service: parsed.data.service });
    return { ok: true };
  });

  app.post('/v1/projects/:id/keys', async (req) => keys.create((req.params as { id: string }).id));
  app.delete('/v1/projects/:id/keys/:keyId', async (req) => { keys.revoke((req.params as { keyId: string }).keyId); return { ok: true }; });
  app.get('/v1/baselines', async () => buildBaselines(await ingestStore.since('dev', Date.now() - 24 * 3600_000)));

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
  (app as unknown as { engine: DriftEngine }).engine = engine;
  app.decorate('detectNow', async () => { const changed = await engine.run(); for (const e of changed) for (const send of sseClients) send('drift.updated', e); return changed; });
  return app;
}
