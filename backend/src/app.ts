import { createHash } from 'node:crypto';
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
import { buildLiveMetrics, buildMetrics, buildStatus, providerStatus } from './status.js';
import { gunzipSync } from 'node:zlib';
import { DriftEngine, type FixDispatcher } from './drift-engine.js';
import { httpFixDispatcher, httpIssueSink, type GithubAppClient } from './fix-dispatcher.js';
import { AiService } from './ai/service.js';
import { suggestionFor } from './ai/templates.js';
import { Dispatcher } from './alerts/dispatcher.js';
import { memorySettings, type SettingsStore } from './settings-store.js';
import { compare, simulate } from './compare.js';
import { Radar, demoSources } from './radar/radar.js';
import { PROJECT_ID, Projects, RateLimiter } from './projects.js';
import { codemapView, enrichEvent } from './codemap-view.js';
import { templateFor } from './fix-templates.js';
import { forwardRules, tryForward } from './forward.js';
import type { RadarItem } from '@seismo/contracts';

export interface AppOptions {
  store?: CodeMapStore; ingest?: IngestStore; keys?: SdkKeys; engine?: DriftEngine; fixer?: FixDispatcher; mocks?: boolean;
  ai?: AiService; dispatcher?: Dispatcher; settings?: SettingsStore; radar?: Radar;
  /** GitHub App installations (account logins) for /v1/me; undefined = not connected. */
  installations?: () => Promise<{ id: number; account: string }[]>;
  projects?: Projects; ingestLimiter?: RateLimiter;
  /** GitHub App actions for onboarding (repos, rescan, setup PR); undefined = not connected. */
  github?: GithubAppClient;
  /** How long an alert waits for the AI text before sending the template (the dashboard gets the AI text when it arrives). */
  alertAiWaitMs?: number;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** One line of the dashboard's live activity feed. */
export interface Activity { id: string; at: string; kind: 'traffic' | 'drift' | 'ai' | 'alert' | 'pr' | 'scan'; text: string; ok?: boolean; service?: string; driftId?: string }

/**
 * Real data everywhere. Contract-shaped mock data is returned ONLY when SEISMO_MOCKS=1 (dashboard development without an engine);
 * otherwise an empty system answers with empty results, never with invented drift.
 */
/** Cache a GitHub lookup for `ttlMs` (installations change rarely; every dashboard page asks for them). Failures are not cached. */
function cached<T>(fn: () => Promise<T>, ttlMs = 30_000): () => Promise<T> {
  let hit: { at: number; value: Promise<T> } | undefined;
  return () => {
    if (hit && Date.now() - hit.at < ttlMs) return hit.value;
    const value = fn();
    hit = { at: Date.now(), value };
    value.catch(() => { hit = undefined; });
    return value;
  };
}

export function buildApp(opts: AppOptions = {}) {
  const mocks = opts.mocks ?? process.env.SEISMO_MOCKS === '1';
  const installationsOf = opts.installations ? cached(opts.installations) : undefined;
  const reposOf = opts.github ? cached(() => opts.github!.repos()) : undefined;
  const store = opts.store ?? memoryStore();
  const ingestStore = opts.ingest ?? memoryIngest();
  const keys = opts.keys ?? new SdkKeys();
  const projects = opts.projects ?? new Projects();
  const ingestLimiter = opts.ingestLimiter ?? new RateLimiter();
  const engine = opts.engine ?? new DriftEngine(ingestStore, () => store.all(), undefined, opts.fixer ?? httpFixDispatcher());
  const sseClients = new Set<(event: string, data: unknown) => void>();
  const broadcast = (event: string, data: unknown) => { for (const send of sseClients) { try { send(event, data); } catch { /* closed client */ } } };
  // v2 live activity feed: what Seismo is doing right now (traffic batches, detections, model calls, alerts, PRs, scans).
  const activityLog: Activity[] = [];
  let activitySeq = 0;
  const activity = (a: Omit<Activity, 'id' | 'at'>) => {
    const entry: Activity = { id: `act-${++activitySeq}`, at: new Date().toISOString(), ...a };
    activityLog.unshift(entry);
    if (activityLog.length > 200) activityLog.length = 200;
    broadcast('activity', entry);
  };
  const settingsStore = opts.settings ?? memorySettings();
  const ai = opts.ai ?? new AiService({
    cacheFile: process.env.AI_CACHE_FILE,
    onCall: (c) => activity({
      kind: 'ai', ok: c.phase !== 'failed',
      text: c.phase === 'start' ? `Asking ${c.model.split('/').pop()} to explain: ${c.title}`
        : c.phase === 'done' ? `${c.model.split('/').pop()} answered in ${((c.latencyMs ?? 0) / 1000).toFixed(1)} s (checked: no invented facts): ${c.title}`
        : c.phase === 'cached' ? `Explanation reused from cache (no model call): ${c.title}`
        : `Model call failed or was rejected; using the template text: ${c.title}`,
    }),
  });
  const dispatcher = opts.dispatcher ?? new Dispatcher({
    settings: () => settingsStore.get(), github: httpIssueSink(), dashboardUrl: process.env.DASHBOARD_URL,
    onNotification: (n) => {
      broadcast('notification', n);
      if (n.channel !== 'dashboard') activity({ kind: 'alert', ok: n.ok, driftId: n.driftId, text: n.ok ? `Alert sent via ${n.channel}: ${n.title}` : `Alert via ${n.channel} failed: ${n.error ?? 'error'}` });
    },
  });
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
        activity({ kind: e.state === 'fix_pending' ? 'pr' : 'drift', service: e.service, driftId: e.id, ok: e.state === 'resolved',
          text: e.state === 'fix_pending' && e.fix?.validation?.prUrl ? `Fix PR opened: ${e.fix.validation.prUrl} (${e.title})`
            : `${e.detector} ${e.state === 'suspected' ? 'suspects' : e.state === 'resolved' ? 'resolved' : 'confirmed'}: ${e.title} [${e.severity}]` });
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

  // v3-P0.5: GitHub webhooks and the demo's fake providers go through this one public service (raw, before parsing)
  const forwards = forwardRules();
  app.addHook('onRequest', async (req, reply) => {
    if (forwards.some((r) => r.target && req.url.startsWith(r.prefix)) && tryForward(req.raw, reply.raw, forwards)) return reply.hijack();
  });

  // Every /v1 route except SDK ingest and SSE is user-scoped (P0.11).
  // ...and to the deployment's project: only its owners see or change anything (v2). /v1/me and /v1/projects stay
  // open to any signed-in user so the dashboard can say "this project belongs to someone else".
  const OPEN_TO_ANY_USER = ['/v1/me', '/v1/projects'];
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/v1/') || req.url.startsWith('/v1/ingest') || req.url.startsWith('/v1/events') || req.url.startsWith('/v1/sdk/')) return;   // SDK routes: key auth
    await requireUser(req, reply);
    if (reply.sent) return;
    const path = req.url.split('?')[0]!;
    if (OPEN_TO_ANY_USER.includes(path) || path.startsWith('/v1/projects/')) return;   // key routes run their own owner check
    if ((await projects.access(PROJECT_ID(), req.user ?? 'demo-user')) !== 'ok') return reply.code(403).send({ error: 'forbidden', message: 'This Seismo project belongs to another account.' });
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
    const all = await installationsOf!().catch(() => []);
    const appSlug = process.env.GITHUB_APP_SLUG ?? 'seismo-app';
    return {
      login, appSlug, installUrl: `https://github.com/apps/${appSlug}/installations/new`,
      installations: all.filter((i) => i.account.toLowerCase() === login.toLowerCase()).map((i) => String(i.id)),
    };
  });
  app.post('/v1/events/token', async (req) => {
    if (!process.env.AUTH_SECRET) return { token: 'dev' };
    return { token: await signUserToken(req.user!, '60s', 'sse') };
  });
  app.get('/v1/overview', async () => {
    const fps = await ingestStore.since(PROJECT_ID(), Date.now() - 10 * 60_000);
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
    scanning.delete(parsed.data.repo);
    activity({ kind: 'scan', ok: true, text: `Code map updated: ${parsed.data.repo} @ ${parsed.data.commit.slice(0, 7)} (${parsed.data.callSites.length} API calls, ${parsed.data.fieldReads.length} field reads)` });
    for (const send of sseClients) send('graph.updated', { repo: parsed.data.repo });
    return { ok: true };
  });
  // v2-P2: installations of the signed-in account with their repos and scan state; rescan and setup PR per repo.
  const scanning = new Map<string, number>();
  const mine = async (login: string) => {
    const all = await reposOf!();
    return all.filter((i) => login === 'demo-user' || i.account.toLowerCase() === login.toLowerCase());
  };
  const ownsRepo = async (login: string, repo: string) => (await mine(login)).some((i) => i.repos.some((r) => r.toLowerCase() === repo.toLowerCase()));
  app.post('/v1/repos/:owner/:repo/scan', async (req, reply) => {
    if (!opts.github) return reply.code(503).send({ error: 'github_app_not_connected' });
    const { owner, repo } = req.params as { owner: string; repo: string };
    const full = `${owner}/${repo}`;
    if (!(await ownsRepo(req.user ?? 'demo-user', full).catch(() => false))) return reply.code(404).send({ error: 'not_found' });
    await opts.github.scan(full);
    scanning.set(full, Date.now());
    return reply.code(202).send({ ok: true });
  });
  app.post('/v1/repos/:owner/:repo/setup-pr', async (req, reply) => {
    if (!opts.github) return reply.code(503).send({ error: 'github_app_not_connected' });
    const { owner, repo } = req.params as { owner: string; repo: string };
    const full = `${owner}/${repo}`;
    if (!(await ownsRepo(req.user ?? 'demo-user', full).catch(() => false))) return reply.code(404).send({ error: 'not_found' });
    try { return await opts.github.setup(full); } catch (e) { return reply.code(502).send({ error: 'setup_failed', message: String((e as Error).message).slice(0, 300) }); }
  });
  app.get('/v1/installations', async (req) => {
    const maps = await store.all();
    if (opts.github) {
      const scanned = new Set(maps.map((m) => m.repo.toLowerCase()));
      const insts = await mine(req.user ?? 'demo-user').catch(() => []);
      return insts.map((i) => ({
        id: String(i.id), account: i.account,
        repos: i.repos.map((full) => {
          const started = scanning.get(full);
          const state = scanned.has(full.toLowerCase()) && !started ? 'done' : started && Date.now() - started < 5 * 60_000 ? 'running' : scanned.has(full.toLowerCase()) ? 'done' : 'pending';
          return { name: full.split('/')[1] ?? full, scan: state as 'done' | 'running' | 'pending', progress: state === 'done' ? 1 : state === 'running' ? 0.5 : 0 };
        }),
      }));
    }
    if (!maps.length) return mocks ? [{ id: 'inst-1', account: 'demo', repos: [{ name: 'seismo-demo-shop', scan: 'done', progress: 1 }] }] : [];
    const byOwner = new Map<string, string[]>();
    for (const m of maps) { const [o, r] = m.repo.split('/') as [string, string]; byOwner.set(o, [...(byOwner.get(o) ?? []), r]); }
    return [...byOwner].map(([account, repos]) => ({ id: `inst-${account}`, account, repos: repos.map((name) => ({ name, scan: 'done' as const, progress: 1 })) }));
  });
  app.get('/v1/metrics', async (req) => {
    // ?range=live: last 32 minutes per minute (what a demo audience sees move); default: 7 days per 6 h
    if ((req.query as { range?: string }).range === 'live') return buildLiveMetrics(await ingestStore.since(PROJECT_ID(), Date.now() - 33 * 60_000), engine.list());
    return buildMetrics(await ingestStore.since(PROJECT_ID(), Date.now() - 7 * 86_400_000), engine.list());
  });
  // v2 demo: the app itself (holding its SDK key) may ask what Seismo has detected for its project: titles and states
  // only, no evidence, no code locations. Used by the demo shop's "Demo changes" panel.
  // v3-P2 self-healing: the SDK asks for live alias rules; it reports how many responses each rule healed.
  // Served only with auto-heal on, only renames whose fix PR passed every check (state fix_pending), never value rules.
  const heal = new Map<string, { hits: number; lastAt?: string; announced?: number }>();
  const liveRules = async () => {
    if (!(await settingsStore.get()).autoHeal) return [];
    return engine.list()
      .filter((e) => e.state === 'fix_pending' && e.fix?.rung === 'alias' && e.fix.rule?.kind === 'alias' && e.fix.validation?.checks.every((c) => c.passed))
      .map((e) => ({ ...e.fix!.rule!, id: e.fix!.rule!.id ?? `live-${e.id}` }));
  };
  app.get('/v1/sdk/rules', async (req, reply) => {
    if (!keys.verify(String(req.headers['x-seismo-key'] ?? ''))) return reply.code(401).send({ error: 'bad_key' });
    const rules = await liveRules();
    const etag = `"${createHash('sha1').update(JSON.stringify(rules)).digest('hex').slice(0, 16)}"`;
    if (req.headers['if-none-match'] === etag) return reply.code(304).send();
    return reply.header('etag', etag).send({ rules });
  });
  app.post('/v1/sdk/rule-hits', async (req, reply) => {
    if (!keys.verify(String(req.headers['x-seismo-key'] ?? ''))) return reply.code(401).send({ error: 'bad_key' });
    const hits = ((req.body ?? {}) as { hits?: Record<string, number> }).hits ?? {};
    for (const [id, n] of Object.entries(hits).slice(0, 200)) {
      if (!Number.isFinite(n) || n <= 0) continue;
      const h = heal.get(id) ?? { hits: 0 };
      h.hits += Math.min(n, 1e6);
      h.lastAt = new Date().toISOString();
      heal.set(id, h);
      if (!h.announced || Date.now() - h.announced > 60_000) {   // one feed line per rule per minute
        h.announced = Date.now();
        const ev = engine.list().find((e) => e.fix?.rule?.id === id || `live-${e.id}` === id);
        activity({ kind: 'pr', ok: true, ...(ev ? { driftId: ev.id, service: ev.service } : {}), text: `Healed live in the app: ${h.hits} response(s) so far with rule ${id}${ev ? ` (${ev.title})` : ''}` });
      }
    }
    return { ok: true };
  });
  const healOf = (e: DriftEvent, live: Set<string>) => {
    const id = e.fix?.rule?.id ?? `live-${e.id}`;
    const h = heal.get(id);
    return live.has(id) || h ? { heal: { live: live.has(id), hits: h?.hits ?? 0, ...(h?.lastAt ? { lastAt: h.lastAt } : {}) } } : {};
  };

  app.get('/v1/sdk/changes', async (req, reply) => {
    const projectId = keys.verify(String(req.headers['x-seismo-key'] ?? ''));
    if (!projectId) return reply.code(401).send({ error: 'bad_key' });
    if (projectId !== PROJECT_ID()) return [];
    return engine.list()
      .filter((e) => !['resolved', 'expected', 'snoozed', 'normal'].includes(e.state))
      .map((e) => ({ id: e.id, service: e.service, endpoint: e.endpoint, detector: e.detector, title: e.title, state: e.state, severity: e.severity, detectedAt: e.detectedAt, prUrl: e.fix?.validation?.prUrl }));
  });
  app.get('/v1/activity', async () => activityLog.slice(0, 100));
  app.get('/v1/codemap', async () => codemapView(await store.all()));
  app.get('/v1/coverage', async () => {
    const maps = await store.all();
    return maps.length || !mocks ? coverage(maps) : { endpointsMapped: 8, endpointsSeen: 9, fieldsMapped: 41, fieldsSeen: 50 };
  });
  app.get('/v1/status', async () => {
    const fps = await ingestStore.since(PROJECT_ID(), Date.now() - 10 * 60_000);
    if (!fps.length) return { services: mocks ? mockStatus() : [] };
    const services = [...new Set(fps.map((f) => f.service))];
    const provider = Object.fromEntries(await Promise.all(services.map(async (sv) => [sv, await providerStatus(sv)] as const)));
    return { services: buildStatus(fps, { provider, states: statesFromEvents(engine.list()) }) };
  });
  app.get('/v1/drift-events', async () => {
    const real = engine.list();
    if (!real.length && mocks) return mockDrift();
    const maps = await store.all();
    const live = new Set((await liveRules()).map((r) => r.id));
    return real.map((e) => ({ ...enrichEvent(e, maps), ...healOf(e, live) }));
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
    await ingestStore.clear(PROJECT_ID());
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
    if (!q.length && mocks) return mockReview();
    const maps = await store.all();
    return q.map(({ event, reason }) => {
      const tpl = templateFor(event);
      // v2: the data rule a fix template would add (the PR opens only when a human asks and the stress test passes)
      return { id: `rev-${event.id}`, drift: enrichEvent(event, maps), suggestion: suggestionFor(event), reason: tpl.rule ? `${reason ?? ''} Fix template: ${tpl.why}`.trim() : `${reason ?? ''} ${tpl.why}`.trim(), ...(tpl.rule ? { proposedRule: tpl.rule } : {}), status: 'open' as const };
    });
  });
  app.post('/v1/review', async (req, reply) => {
    const parsed = ReviewAction.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request', message: parsed.error.message });
    const id = parsed.data.id.replace(/^rev-/, '');
    if (!engine.get(id)) return reply.code(404).send({ error: 'unknown_event' });
    if (parsed.data.action === 'open_pr') {
      const ev = engine.get(id)!;
      const r = await engine.openTemplatePr(id, await repoFor(ev.service)).catch((e: Error) => ({ error: e.message, event: undefined }));
      if (r.error || !r.event) return reply.code(409).send({ error: 'not_available', message: r.error });
      broadcast('drift.updated', r.event);
      return { ok: true, prUrl: r.event.fix?.validation?.prUrl };
    }
    if (parsed.data.action === 'reopen') {
      // undo of expected/snooze from the dashboard: back to what the detector said
      const ev = engine.get(id)!;
      engine.setState(id, ev.severity === 'breaking' ? 'breaking' : 'suspected');
      broadcast('drift.updated', engine.get(id));
      return { ok: true };
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
    return compare(await ingestStore.since(PROJECT_ID(), Date.now() - 24 * 3600_000), service, endpoint);
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

  // One fingerprint is a few KB; 512 KB is far above any real batch and stops oversized bodies early.
  const seenBatches = new Set<string>();
  app.post('/v1/ingest', { bodyLimit: 512 * 1024 }, async (req, reply) => {
    const projectId = keys.verify(String(req.headers['x-seismo-key'] ?? ''));
    if (!projectId) return reply.code(401).send({ error: 'bad_key' });
    const wait = ingestLimiter.take(projectId);
    if (wait) return reply.code(429).header('retry-after', String(wait)).send({ error: 'rate_limited', retryAfterSeconds: wait });
    const parsed = Fingerprint.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_fingerprint', message: parsed.error.message });
    // v3-P3.1: an SDK resend after a timeout carries the same batchId: accept it, store it once
    if (parsed.data.batchId) {
      const k = `${projectId}|${parsed.data.batchId}`;
      if (seenBatches.has(k)) return { ok: true, duplicate: true };
      seenBatches.add(k);
      if (seenBatches.size > 50_000) seenBatches.delete(seenBatches.values().next().value!);
    }
    await ingestStore.add(projectId, parsed.data);
    const fp = parsed.data;
    const errs = Object.entries(fp.statusCounts).filter(([s]) => Number(s) >= 400).reduce((n, [, c]) => n + c, 0);
    activity({ kind: 'traffic', service: fp.service, ok: errs === 0, text: `${fp.service}: ${fp.count} call${fp.count === 1 ? '' : 's'} to ${fp.method} ${fp.endpoint}${errs ? ` (${errs} errors)` : ''} · ${Object.keys(fp.fields).length} fields profiled` });
    for (const send of sseClients) send('status.updated', { service: parsed.data.service });
    return { ok: true };
  });

  // P3.4: only the project's owner manages its keys; another project id is 404, someone else's project is 403.
  const guard = async (req: { params: unknown; user?: string }, reply: { code: (c: number) => { send: (b: unknown) => unknown } }) => {
    const r = await projects.access((req.params as { id: string }).id, req.user ?? 'demo-user');
    return r === 'ok' ? undefined : reply.code(r === 'not_found' ? 404 : 403).send({ error: r });
  };
  app.get('/v1/projects', async (req) => projects.list(req.user ?? 'demo-user'));
  app.get('/v1/projects/:id/keys', { preHandler: guard }, async (req) => keys.list((req.params as { id: string }).id));
  app.post('/v1/projects/:id/keys', { preHandler: guard }, async (req) => keys.create((req.params as { id: string }).id, req.user));
  app.delete('/v1/projects/:id/keys/:keyId', { preHandler: guard }, async (req, reply) => {
    const p = req.params as { id: string; keyId: string };
    return keys.revoke(p.keyId, p.id) ? { ok: true } : reply.code(404).send({ error: 'not_found' });
  });
  app.get('/v1/baselines', async () => buildBaselines(await ingestStore.since(PROJECT_ID(), Date.now() - 24 * 3600_000)));

  // SSE stub (P0.4). Real events arrive with P2/P4.
  app.get('/v1/events', async (req, reply) => {
    const sseUser = await userFrom(req, 'sse');
    if (!sseUser) return reply.code(401).send({ error: 'unauthorized' });
    if ((await projects.access(PROJECT_ID(), sseUser)) !== 'ok') return reply.code(403).send({ error: 'forbidden' });
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
