import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { gzipSync } from 'fflate';
import { BatchInterceptor } from '@mswjs/interceptors';
import { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest';
import { createHash } from 'node:crypto';
import { normalise, percentile } from './classify.js';
import { finish, observe, type FieldAcc, type FpConfig } from './fingerprint.js';
import { drainRuleHits, setLiveAliasRules } from './runtime.js';

export interface InitOptions {
  key: string;
  /** Seismo backend base URL. */
  endpoint?: string;
  sampleRate?: number;            // default 0.1; use 1 in demo mode
  flushMs?: number;               // default 5000
  maxBodyBytes?: number;          // default 256 KB
  maxQueue?: number;              // default 1000 windows
  enumAllowList?: string[];
  neverInspect?: string[];
  /** Hosts to watch; default all except private ranges and the Seismo endpoint. */
  allowHosts?: string[];
  /** URL prefixes never recorded (e.g. a provider's admin or health routes). */
  ignore?: string[];
  /** v3-P2: fetch live (self-healing) alias rules from Seismo; default true. Seismo only serves them when auto-heal is on. */
  liveRules?: boolean;
  /** Map URL prefixes to service names, e.g. { 'http://localhost:4100/users': 'users' }. Default: the host. */
  services?: Record<string, string>;
  salt?: string;                  // default: random per process (set it to keep hashes comparable across restarts)
  onError?: (err: unknown) => void;
}

interface Window {
  service: string; method: string; endpoint: string; statusClass: string; start: number;
  count: number; statuses: Record<string, number>; latencies: number[];
  headers: Record<string, string>; queryKeys: Set<string>; limit?: number;
  accs: Map<string, FieldAcc>;
}

const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/;

/** Set while a Seismo fetch wrapper is recording a call (see rewrapIfReplaced). */
const observing = new AsyncLocalStorage<boolean>();

/** Read-only, fail-open API sensor. Everything below is wrapped so it can never throw into the host app. */
export class Seismo {
  private interceptor?: BatchInterceptor<[ClientRequestInterceptor]>;
  private realFetch?: typeof fetch;
  private wrappedFetch?: typeof fetch;
  private windows = new Map<string, Window>();
  private ready: Record<string, unknown>[] = [];
  /** fingerprints waiting to be delivered (kept across failed flushes, bounded by maxQueue) */
  get pending() { return this.ready.length; }
  private timer?: NodeJS.Timeout;
  private rulesTimer?: NodeJS.Timeout;
  private rulesEtag = '';
  /** v3-P3.1: do not send before this time (the backend asked us to wait with 429 Retry-After) */
  private pausedUntil = 0;
  private starts = new Map<string, number>();
  private held = new Map<string, number[]>();
  private o!: Required<Pick<InitOptions, 'sampleRate' | 'flushMs' | 'maxBodyBytes' | 'maxQueue'>> & InitOptions;
  private cfg!: FpConfig;
  dropped = 0;
  errors = 0;
  private saltId = '';

  init(opts: InitOptions) {
    try {
      this.stop();
      this.o = { sampleRate: 0.1, flushMs: 5000, maxBodyBytes: 256 * 1024, maxQueue: 1000, endpoint: 'http://localhost:4000', ...opts };
      const salt = opts.salt ?? process.env['SEISMO_SALT'] ?? stableSalt(opts.key);
      this.saltId = createHash('sha256').update(`seismo-salt-id|${salt}`).digest('hex').slice(0, 12);
      this.cfg = { salt, enumAllowList: opts.enumAllowList ?? [], neverInspect: opts.neverInspect ?? [], maxFields: 500, maxDepth: 8, maxArrayItems: 50 };
      // fetch: wrapped directly. The library's socket-level fetch interception misses requests on keep-alive
      // sockets opened before init() (verified: half of all calls were invisible), a direct wrapper sees every call.
      this.wrapFetch();
      // node:http / https (axios, got, older clients): the interceptor library.
      this.interceptor = new BatchInterceptor({ name: 'seismo', interceptors: [new ClientRequestInterceptor()] });
      this.interceptor.on('request', ({ requestId }) => { try { this.starts.set(requestId, performance.now()); } catch (e) { this.fail(e); } });
      this.interceptor.on('response', ({ request, response, requestId }) => {
        try {
          const started = this.starts.get(requestId) ?? performance.now();
          this.starts.delete(requestId);
          this.observeResponse(request.url, request.method, response, performance.now() - started);
        } catch (e) { this.fail(e); }
      });
      this.interceptor.apply();
      this.timer = setInterval(() => { this.rewrapIfReplaced(); void this.flush(); }, this.o.flushMs);
      if (this.o.liveRules !== false) {
        void this.pollRules();
        this.rulesTimer = setInterval(() => void this.pollRules(), 30_000);
        this.rulesTimer.unref();
      }
      this.timer.unref();
    } catch (e) { this.fail(e); }
    return this;
  }

  stop() {
    try { this.interceptor?.dispose(); } catch { /* ignore */ }
    // Restore fetch only if nobody wrapped it after us (never break a later wrapper).
    if (this.realFetch && globalThis.fetch === this.wrappedFetch) globalThis.fetch = this.realFetch;
    this.realFetch = this.wrappedFetch = undefined;
    if (this.timer) clearInterval(this.timer);
    if (this.rulesTimer) clearInterval(this.rulesTimer);
    this.interceptor = undefined;
  }

  /**
   * Frameworks may replace globalThis.fetch after init (Next.js dev re-patches it on hot reload), which would silently
   * blind the SDK. Every flush tick checks and wraps the current fetch again. The outermost wrapper records the call;
   * inner ones (when a framework wrapped ours) pass straight through, so nothing is counted twice.
   */
  rewrapIfReplaced() {
    try {
      if (this.wrappedFetch && typeof globalThis.fetch === 'function' && globalThis.fetch !== this.wrappedFetch) this.wrapFetch(true);
    } catch (e) { this.fail(e); }
  }

  private wrapFetch(again = false) {
    if (typeof globalThis.fetch !== 'function') return;
    const real = globalThis.fetch;
    const wrapped = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      if (observing.getStore()) return real(input, init);   // an outer Seismo wrapper already records this call
      return observing.run(true, async () => {
      const started = performance.now();
      const res = await real(input, init);            // errors from the real fetch propagate exactly as before
      try {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        this.observeResponse(url, method, res, performance.now() - started);
      } catch (e) { this.fail(e); }
      return res;                                       // the app gets the original, untouched Response
      });
    }) as typeof fetch;
    if (!again) this.realFetch = real;                  // stop() restores the fetch from before init
    this.wrappedFetch = wrapped;
    globalThis.fetch = wrapped;
  }

  /** Shared by both capture paths. Only touches a clone; all real work happens after the app has its response. */
  private observeResponse(url: string, method: string, response: Response, latency: number) {
    if (!this.shouldSample(url)) return;
    const clone = response.clone();
    const meta = { url, method, status: response.status, headers: response.headers };
    const work = new Promise<void>((done) => setImmediate(() => { void this.capture(meta, clone, latency).finally(done); }));
    this.keepAliveOnServerless(work);
  }

  /**
   * Serverless (Vercel, and anything exposing the same request context): the function is frozen right after the response,
   * so timers never fire and nothing would be sent. There, the capture plus one flush are handed to the platform's
   * waitUntil, once per request. Elsewhere this does nothing. Never throws, never delays the response.
   */
  private pendingCaptures = 0;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private flushed?: { promise: Promise<void>; resolve: () => void };
  private keepAliveOnServerless(work: Promise<void>) {
    try {
      const ctx = (globalThis as Record<symbol, { get?: () => { waitUntil?: (p: Promise<unknown>) => void } | undefined } | undefined>)[Symbol.for('@vercel/request-context')]?.get?.();
      if (!ctx?.waitUntil) return;
      ctx.waitUntil(work);
      // one flush once the request's calls are done (150 ms with nothing in flight), kept alive with waitUntil
      if (!this.flushed) {
        let resolve!: () => void;
        const promise = new Promise<void>((r) => { resolve = r; });
        this.flushed = { promise, resolve };
        ctx.waitUntil(promise);
      }
      clearTimeout(this.idleTimer);
      this.pendingCaptures++;
      void work.finally(() => {
        if (--this.pendingCaptures > 0) return;
        this.idleTimer = setTimeout(() => {
          const done = this.flushed;
          this.flushed = undefined;
          void this.flush().finally(() => done?.resolve());
        }, 150);
      });
    } catch (e) { this.fail(e); }
  }

  private fail(e: unknown) { this.errors++; try { this.o?.onError?.(e); } catch { /* ignore */ } }

  private shouldSample(rawUrl: string) {
    const u = new URL(rawUrl);
    // never its own uploads (/v1/ingest, /v1/sdk/*). Only those: a hosted engine may serve the APIs the app calls on
    // the same host (found live: every provider call was skipped when engine and providers shared one URL)
    if (this.o.endpoint && rawUrl.startsWith(`${this.o.endpoint.replace(/\/$/, '')}/v1/`)) return false;
    if (this.o.ignore?.some((p) => p && rawUrl.startsWith(p))) return false;
    if (this.o.allowHosts) { if (!this.o.allowHosts.includes(u.host)) return false; }
    else if (PRIVATE.test(u.hostname) && !this.o.services) return false;
    return Math.random() < this.o.sampleRate;
  }

  private serviceOf(url: URL) {
    // the most specific prefix wins ("http://x/orders" before "http://x")
    let best: [string, string] | undefined;
    for (const [prefix, name] of Object.entries(this.o.services ?? {})) if (url.href.startsWith(prefix) && (!best || prefix.length > best[0].length)) best = [prefix, name];
    return best ? best[1] : url.host;
  }

  private async capture(meta: { url: string; method: string; status: number; headers: Headers }, res: Response, latency: number) {
    try {
      const url = new URL(meta.url);
      const { endpoint, queryKeys, limit } = normalise(url);
      const service = this.serviceOf(url);
      const statusClass = `${Math.floor(meta.status / 100)}xx`;
      const key = `${service}|${meta.method}|${endpoint}|${statusClass}`;
      let w = this.windows.get(key);
      if (!w) {
        w = { service, method: meta.method, endpoint, statusClass, start: Date.now(), count: 0, statuses: {}, latencies: [], headers: {}, queryKeys: new Set(), accs: new Map() };
        this.windows.set(key, w);
      }
      w.count++;
      w.statuses[String(meta.status)] = (w.statuses[String(meta.status)] ?? 0) + 1;
      w.latencies.push(latency);
      queryKeys.forEach((k) => w!.queryKeys.add(k));
      if (limit !== undefined) w.limit = limit;
      const h = meta.headers;
      for (const [name, field] of [['deprecation', 'deprecation'], ['sunset', 'sunset'], ['x-ratelimit-limit', 'rateLimitLimit'], ['x-ratelimit-remaining', 'rateLimitRemaining'], ['content-type', 'contentType']] as const) {
        const v = h.get(name);
        if (v) w.headers[field] = v.slice(0, 120);
      }
      const ct = h.get('content-type') ?? '';
      const len = Number(h.get('content-length') ?? 0);
      if (ct.includes('json') && len <= this.o.maxBodyBytes) {
        const text = await res.text();
        if (text.length <= this.o.maxBodyBytes) observe(JSON.parse(text), w.accs, this.cfg);
      }
    } catch (e) { this.fail(e); }
  }

  /**
   * Webhook drift (P6.12): fingerprint an INBOUND provider webhook body (shape only, same privacy rules).
   * Call it from the webhook route: `seismo.observeWebhook('payments', 'payment.captured', req.body)`. Never throws.
   */
  observeWebhook(provider: string, event: string, body: unknown, status = 200) {
    try {
      if (Math.random() >= (this.o?.sampleRate ?? 0)) return;
      const key = `webhook:${provider}|POST|/webhooks/${event}|2xx`;
      let w = this.windows.get(key);
      if (!w) { w = { service: `webhook:${provider}`, method: 'POST', endpoint: `/webhooks/${event}`, statusClass: '2xx', start: Date.now(), count: 0, statuses: {}, latencies: [], headers: {}, queryKeys: new Set(), accs: new Map() }; this.windows.set(key, w); }
      w.count++;
      w.statuses[String(status)] = (w.statuses[String(status)] ?? 0) + 1;
      w.latencies.push(0);
      observe(body, w.accs, this.cfg);
    } catch (e) { this.fail(e); }
  }

  /** Wrap a webhook handler `(body, ...rest)`: observes the body, then calls the handler unchanged. */
  webhook<A extends unknown[], R>(provider: string, event: string, handler: (body: unknown, ...rest: A) => R): (body: unknown, ...rest: A) => R {
    return (body, ...rest) => { this.observeWebhook(provider, event, body); return handler(body, ...rest); };
  }

  /** Close the windows and send them. Retry once, then drop. Never throws. */
  async flush() {
    try {
      const now = Date.now();
      for (const [k, w] of this.windows) {
        this.windows.delete(k);
        // Carry held-back numeric values into this window so small batches still contribute.
        for (const [path, a] of w.accs) { const prev = this.held.get(`${k}|${path}`); if (prev) a.nums.push(...prev); this.held.delete(`${k}|${path}`); }
        const { fields, held } = finish(w.accs);
        for (const [path, nums] of held) this.held.set(`${k}|${path}`, nums.slice(-50));
        const shape = createHash('sha256').update(JSON.stringify(Object.entries(fields).map(([p, f]) => [p, Object.keys((f as { types: object }).types).sort()]).sort())).digest('hex').slice(0, 16);
        this.ready.push({
          v: 1, service: w.service, method: w.method, endpoint: w.endpoint, statusClass: w.statusClass,
          windowStart: new Date(w.start).toISOString(), windowSeconds: Math.max(1, Math.round((now - w.start) / 1000)),
          count: w.count, statusCounts: w.statuses,
          latencyMs: { p50: Math.round(percentile(w.latencies, 0.5)), p95: Math.round(percentile(w.latencies, 0.95)) },
          headers: w.headers, reqQueryKeys: [...w.queryKeys], ...(w.limit !== undefined ? { reqLimit: w.limit } : {}),
          shapeHash: shape, fields,
        });
      }
      if (this.ready.length > this.o.maxQueue) { this.dropped += this.ready.length - this.o.maxQueue; this.ready = this.ready.slice(-this.o.maxQueue); }
      const hits = drainRuleHits();
      if (Object.keys(hits).length) void this.post('/v1/sdk/rule-hits', { hits });
      if (Date.now() < this.pausedUntil) return;               // backend asked us to wait: keep everything queued
      const batch = this.ready.splice(0, this.ready.length);
      for (let i = 0; i < batch.length; i++) {
        const ok = await this.send(batch[i]!);
        // v3-P3.1: not delivered -> back in the (bounded) queue for the next flush, in order, never dropped silently
        if (!ok) { this.ready.unshift(...batch.slice(i)); break; }
      }
    } catch (e) { this.fail(e); }
  }

  /** true = delivered (or rejected for good, e.g. a bad key); false = try again later. */
  private async send(fp: Record<string, unknown>): Promise<boolean> {
    fp['batchId'] ??= randomBytes(9).toString('base64url');   // the same id on every retry: the backend ignores repeats
    if (this.saltId) fp['saltId'] ??= this.saltId;
    const body = gzipSync(new TextEncoder().encode(JSON.stringify(fp)));
    try {
      const r = await fetch(`${this.o.endpoint}/v1/ingest`, {
        method: 'POST', body, signal: AbortSignal.timeout(3000),
        headers: { 'content-type': 'application/json', 'content-encoding': 'gzip', 'x-seismo-key': this.o.key },
      });
      if (r.status === 429) {
        const wait = Number(r.headers.get('retry-after'));
        this.pausedUntil = Date.now() + (Number.isFinite(wait) && wait > 0 ? Math.min(wait, 300) : 30) * 1000;
        return false;
      }
      if (r.ok || r.status < 500) return true;
      return false;
    } catch { return false; }
  }

  private async post(path: string, body: unknown) {
    try {
      await fetch(`${this.o.endpoint}${path}`, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(3000), headers: { 'content-type': 'application/json', 'x-seismo-key': this.o.key } });
    } catch { /* fail-open */ }
  }

  /** v3-P2: the alias rules Seismo serves live for this project. Keeps the last good set when Seismo is unreachable. */
  async pollRules() {
    try {
      const r = await fetch(`${this.o.endpoint}/v1/sdk/rules`, { signal: AbortSignal.timeout(3000), headers: { 'x-seismo-key': this.o.key, ...(this.rulesEtag ? { 'if-none-match': this.rulesEtag } : {}) } });
      if (r.status === 304 || !r.ok) return;
      const j = (await r.json()) as { rules?: unknown };
      setLiveAliasRules(j.rules);
      this.rulesEtag = r.headers.get('etag') ?? '';
    } catch { /* fail-open: keep the last rules */ }
  }
}

export const seismo = new Seismo();

/**
 * The salt must stay on this machine and should survive restarts: with a new salt every hashed value looks new, which
 * hides renames (value similarity drops) and invents "new values". SEISMO_SALT wins; otherwise a random salt is kept
 * in the OS temp dir (per key). Anything failing falls back to a per-process salt (saltId tells the backend it changed).
 */
function stableSalt(key: string): string {
  try {
    const file = join(tmpdir(), `seismo-salt-${createHash('sha256').update(key).digest('hex').slice(0, 12)}`);
    try { const s = readFileSync(file, 'utf8').trim(); if (/^[0-9a-f]{32}$/.test(s)) return s; } catch { /* first run */ }
    const s = randomBytes(16).toString('hex');
    writeFileSync(file, s, { mode: 0o600 });
    return s;
  } catch { return randomBytes(16).toString('hex'); }
}
