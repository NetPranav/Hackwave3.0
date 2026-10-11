import Fastify from 'fastify';
import cors from '@fastify/cors';
import { requireUser, signUserToken, userFrom } from './auth.js';
import {
  mockDrift, mockGraph, mockMe, mockOverview, mockRadar, mockReview, mockStatus,
  CodeMap, Fingerprint, NotificationSettings, ReviewAction, SimulateRequest, type DriftEvent,
} from '@seismo/contracts';
import { buildGraph, coverage, impact, statesFromEvents } from './graph.js';
import { memoryStore, type CodeMapStore } from './codemap-store.js';
import { memoryIngest, SdkKeys, type IngestStore } from './ingest-store.js';
import { buildBaselines } from './baseline.js';
import { buildStatus, providerStatus } from './status.js';
import { gunzipSync } from 'node:zlib';
import { DriftEngine, type FixDispatcher } from './drift-engine.js';
import { httpFixDispatcher, httpIssueSink } from './fix-dispatcher.js';
import { AiService } from './ai/service.js';
import { suggestionFor } from './ai/templates.js';
import { Dispatcher } from './alerts/dispatcher.js';
import { memorySettings, type SettingsStore } from './settings-store.js';
import { compare, simulate } from './compare.js';
import { Radar, demoSources } from './radar/radar.js';
import type { RadarItem } from '@seismo/contracts';

export interface AppOptions {
  store?: CodeMapStore; ingest?: IngestStore; keys?: SdkKeys; engine?: DriftEngine; fixer?: FixDispatcher; mocks?: boolean;
  ai?: AiService; dispatcher?: Dispatcher; settings?: SettingsStore; radar?: Radar;
  /** GitHub App installations (account logins) for /v1/me; undefined = not connected. */
  installations?: () => Promise<{ id: number; account: string }[]>;
  /** How long an alert waits for the AI text before sending the template (the dashboard gets the AI text when it arrives). */
  alertAiWaitMs?: number;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Real data everywhere. Contract-shaped mock data is returned ONLY when SEISMO_MOCKS=1 (dashboard development without an engine);
 * otherwise an empty system answers with empty results, never with invented drift.
 */
export function buildApp(opts: AppOptions = {}) {
  const mocks = opts.mocks ?? process.env.SEISMO_MOCKS === '1';
  const store = opts.store ?? memoryStore();
  const ingestStore = opts.ingest ?? memoryIngest();
  const keys = opts.keys ?? new SdkKeys();
  const engine = opts.engine ?? new DriftEngine(ingestStore, () => store.all(), undefined, opts.fixer ?? httpFixDispatcher());
  const sseClients = new Set<(event: string, data: unknown) => void>();
  const broadcast = (event: string, data: unknown) => { for (const send of sseClients) { try { send(event, data); } catch { /* closed client */ } } };
  const settingsStore = opts.settings ?? memorySettings();
  const ai = opts.ai ?? new AiService({ cacheFile: process.env.AI_CACHE_FILE });
  const dispatcher = opts.dispatcher ?? new Dispatcher({ settings: () => settingsStore.get(), github: httpIssueSink(), dashboardUrl: process.env.DASHBOARD_URL, onNotification: (n) => broadcast('notification', n) });
  const alertWait = opts.alertAiWaitMs ?? Number(process.env.ALERT_AI_WAIT_MS ?? 8000);
  const radar = opts.radar ?? new Radar({ sources: demoSources(), maps: () => store.all(), ai: { client: ai.client, model: process.env.NIM_MODEL_EXPLAIN ?? 'nvidia/nemotron-3-super-120b-a12b', enabled: () => true } });
  /** New radar items go to the same dispatcher (P7.6); announced changes are never "breaking". */
  async function alertRadar(items: RadarItem[]) {
    for (const i of items) {
      try {
        broadcast('radar.created', i);
        if (i.severity === 'info') continue;
        const pseudo: DriftEvent = { id: i.id, service: i.service, endpoint: i.endpoint ?? i.service, ...(i.field ? { field: i.field } : {}), detector: 'RADAR', title: `Announced: ${i.title}`.slice(0, 120), severity: i.severity, state: 'suspected', confidence: 0.8, detectedAt: i.detectedAt ?? new Date().toISOString(), before: null, after: null, usages: i.matchedFiles.map((f) => { const [file, line] = f.split(':'); return { file: file!, line: Number(line), kind: 'call' }; }) };
        await dispatcher.dispatch(pseudo, ai.template({ ...pseudo, title: pseudo.title }), await repoFor(i.service));
      } catch (err) { app.log.error({ err, item: i.id }, 'radar alert failed'); }
    }
  }
  const repoFor = async (service: string) => (await store.all()).flatMap((m) => m.callSites).find((c) => c.service === service && !c.unresolved)?.repo;

  /**
   * After every detection pass (P6): SSE, template explanation at once, AI explanation (waited for up to `alertWait`),
   * alerts on every channel, then the full AI text + enum judgement attached when it arrives. Never throws.
   */
  async function afterDetect(changed: DriftEvent[]) {
    for (const e of changed) {
      try {
        broadcast(e.state === 'suspected' || e.state === 'normal' ? 'drift.created' : 'drift.updated', e);
        if (e.severity === 'info' && e.state !== 'resolved') continue;
        const s = await settingsStore.get();
        const tpl = ai.template(e);
        if (!engine.get(e.id)?.explanation) engine.attach(e.id, { explanation: tpl });
        const aiP = s.aiEnabled ? ai.explain(e) : Promise.resolve(tpl);
        const judgeP = s.aiEnabled ? ai.judgeEnum(e) : Promise.resolve(undefined);
        const x = await Promise.race([aiP, sleep(alertWait).then(() => tpl)]);
        await dispatcher.dispatch(engine.get(e.id) ?? e, x, await repoFor(e.service));
        void Promise.all([aiP, judgeP]).then(([full, judgement]) => {
          engine.attach(e.id, { explanation: { ...full, ...(judgement ? { judgement } : {}) } });
          const ev = engine.get(e.id);
          if (ev) broadcast('drift.updated', ev);
        }).catch(() => undefined);
      } catch (err) { app.log.error({ err, event: e.id }, 'post-detection pipeline failed'); }
    }
  }
  const app = Fastify({ logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' } });
  app.register(cors, { origin: true });

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
  // Readiness: the stores answer (Postgres reachable when configured).
  app.get('/ready', async (_req, reply) => {
    try {
      await Promise.race([Promise.all([store.all(), settingsStore.get()]), sleep(3000).then(() => { throw new Error('timeout'); })]);
      return { ok: true };
    } catch (e) { return reply.code(503).send({ ok: false, error: String((e as Error).message) }); }
  });

  // The signed-in user and the GitHub App installations on their account (P0.11).
  app.get('/v1/me', async (req) => {
    const login = req.user ?? 'demo-user';
    if (!opts.installations) return mocks ? { ...mockMe(), login } : { login, installations: [] };
    const all = await opts.installations().catch(() => []);
    return { login, installations: all.filter((i) => i.account.toLowerCase() === login.toLowerCase()).map((i) => String(i.id)) };
  });
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
    if (ev) await afterDetect([ev]);            // closes the GitHub issue, updates the dashboard
    return { ok: !!ev };
  });
  // The GitHub App reports the customer's CI result on fix PRs here (P5.6: C7/C8).
  app.post('/internal/fix-ci', async (req, reply) => {
    if (req.headers['x-internal-token'] !== (process.env.INTERNAL_TOKEN ?? 'dev-internal')) return reply.code(401).send({ error: 'unauthorized' });
    const { ruleId, conclusion, app: by } = req.body as { ruleId: string; conclusion: string; app?: string };
    const ev = engine.recordCi(ruleId, String(conclusion), by);
    if (ev) broadcast('drift.updated', ev);
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
    await afterDetect(changed);
    return { changed: changed.length };
  });
  app.get('/v1/radar', async () => {
    radar.fromHeaders(engine.list());
    const items = radar.list(engine.list());
    return items.length || !mocks ? items : mockRadar();
  });
  // P8.5: demo reset (data side). Services are reset by the script; the repo side goes through the GitHub App.
  app.post('/internal/demo/reset', async (req, reply) => {
    if (req.headers['x-internal-token'] !== (process.env.INTERNAL_TOKEN ?? 'dev-internal')) return reply.code(401).send({ error: 'unauthorized' });
    await engine.clear();
    await ingestStore.clear('dev');
    dispatcher.clear();
    radar.clear();
    broadcast('demo.reset', {});
    return { ok: true };
  });
  app.post('/internal/radar/poll', async (req, reply) => {
    if (req.headers['x-internal-token'] !== (process.env.INTERNAL_TOKEN ?? 'dev-internal')) return reply.code(401).send({ error: 'unauthorized' });
    const fresh = [...(await radar.poll()), ...radar.fromHeaders(engine.list())];
    await alertRadar(fresh);
    return { created: fresh.length, items: fresh };
  });
  // Review queue (P6.6): every non-alias event, with the deterministic suggestion and the AI explanation if present.
  app.get('/v1/review', async () => {
    const q = engine.reviewQueue();
    return q.length || !mocks ? q.map(({ event, reason }) => ({ id: `rev-${event.id}`, drift: event, suggestion: suggestionFor(event), reason, status: 'open' as const })) : mockReview();
  });
  app.post('/v1/review', async (req, reply) => {
    const parsed = ReviewAction.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request', message: parsed.error.message });
    const id = parsed.data.id.replace(/^rev-/, '');
    if (!engine.get(id)) return reply.code(404).send({ error: 'unknown_event' });
    if (parsed.data.action === 'open_pr') {
      const ev = engine.get(id)!;
      const r = await engine.openScalePr(id, await repoFor(ev.service)).catch((e: Error) => ({ error: e.message, event: undefined }));
      if (r.error || !r.event) return reply.code(409).send({ error: 'not_available', message: r.error });
      broadcast('drift.updated', r.event);
      return { ok: true, prUrl: r.event.fix?.validation?.prUrl };
    }
    engine.setState(id, parsed.data.action === 'expected' ? 'expected' : 'snoozed');
    broadcast('drift.updated', engine.get(id));
    return { ok: true };
  });
  // Notification settings (P6.13) + bell (P6.7)
  app.get('/v1/settings/notifications', async () => settingsStore.get());
  app.put('/v1/settings/notifications', async (req, reply) => {
    const parsed = NotificationSettings.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_settings', message: parsed.error.message });
    return settingsStore.put(parsed.data);
  });
  app.post('/v1/notifications/test', async () => ({ sent: await dispatcher.test() }));
  app.get('/v1/notifications', async () => dispatcher.log);
  app.post('/v1/notifications/read', async (req) => {
    const ids = new Set(((req.body ?? {}) as { ids?: string[] }).ids ?? dispatcher.log.map((n) => n.id));
    for (const n of dispatcher.log) if (ids.has(n.id)) n.read = true;
    return { ok: true };
  });
  // Compare & Simulate (P6.10)
  app.get('/v1/compare', async (req, reply) => {
    const { service, endpoint } = req.query as { service?: string; endpoint?: string };
    if (!service || !endpoint) return reply.code(400).send({ error: 'bad_request', message: 'service and endpoint (e.g. "GET /users/{id}") are required' });
    return compare(await ingestStore.since('dev', Date.now() - 24 * 3600_000), service, endpoint);
  });
  app.post('/v1/simulate', async (req, reply) => {
    const parsed = SimulateRequest.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request', message: parsed.error.message });
    return simulate(parsed.data, await store.all());
  });
  // P6.11: explain the demo scenarios once so the stage demo never waits on the model.
  app.post('/internal/ai/warm', async (req, reply) => {
    if (req.headers['x-internal-token'] !== (process.env.INTERNAL_TOKEN ?? 'dev-internal')) return reply.code(401).send({ error: 'unauthorized' });
    const events = ((req.body ?? {}) as { events?: DriftEvent[] }).events ?? engine.list();
    const out = [];
    for (const e of events) { const x = await ai.explain(e); out.push({ id: e.id, source: x.source, model: x.model, latencyMs: x.latencyMs }); }
    return { warmed: out };
  });

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
  (app as unknown as { dispatcher: Dispatcher; ai: AiService }).dispatcher = dispatcher;
  (app as unknown as { dispatcher: Dispatcher; ai: AiService }).ai = ai;
  app.decorate('detectNow', async () => { const changed = await engine.run(); await afterDetect(changed); await alertRadar(radar.fromHeaders(engine.list())); return changed; });
  app.decorate('pollRadar', async () => { const fresh = await radar.poll(); await alertRadar(fresh); return fresh; });
  return app;
}
