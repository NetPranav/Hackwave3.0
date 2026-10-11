import { randomBytes } from 'node:crypto';
import { gzipSync } from 'fflate';
import { BatchInterceptor } from '@mswjs/interceptors';
import { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest';
import { createHash } from 'node:crypto';
import { normalise, percentile } from './classify.js';
import { finish, observe, type FieldAcc, type FpConfig } from './fingerprint.js';

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

/** Read-only, fail-open API sensor. Everything below is wrapped so it can never throw into the host app. */
export class Seismo {
  private interceptor?: BatchInterceptor<[ClientRequestInterceptor]>;
  private realFetch?: typeof fetch;
  private wrappedFetch?: typeof fetch;
  private windows = new Map<string, Window>();
  private ready: unknown[] = [];
  private timer?: NodeJS.Timeout;
  private starts = new Map<string, number>();
  private held = new Map<string, number[]>();
  private o!: Required<Pick<InitOptions, 'sampleRate' | 'flushMs' | 'maxBodyBytes' | 'maxQueue'>> & InitOptions;
  private cfg!: FpConfig;
  dropped = 0;
  errors = 0;

  init(opts: InitOptions) {
    try {
      this.stop();
      this.o = { sampleRate: 0.1, flushMs: 5000, maxBodyBytes: 256 * 1024, maxQueue: 1000, endpoint: 'http://localhost:4000', ...opts };
      this.cfg = { salt: opts.salt ?? randomBytes(16).toString('hex'), enumAllowList: opts.enumAllowList ?? [], neverInspect: opts.neverInspect ?? [], maxFields: 500, maxDepth: 8, maxArrayItems: 50 };
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
      this.timer = setInterval(() => void this.flush(), this.o.flushMs);
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
    this.interceptor = undefined;
  }

  private wrapFetch() {
    if (typeof globalThis.fetch !== 'function') return;
    const real = globalThis.fetch;
    const wrapped = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      const started = performance.now();
      const res = await real(input, init);            // errors from the real fetch propagate exactly as before
      try {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        this.observeResponse(url, method, res, performance.now() - started);
      } catch (e) { this.fail(e); }
      return res;                                       // the app gets the original, untouched Response
    }) as typeof fetch;
    this.realFetch = real;
    this.wrappedFetch = wrapped;
    globalThis.fetch = wrapped;
  }

  /** Shared by both capture paths. Only touches a clone; all real work happens after the app has its response. */
  private observeResponse(url: string, method: string, response: Response, latency: number) {
    if (!this.shouldSample(url)) return;
    const clone = response.clone();
    const meta = { url, method, status: response.status, headers: response.headers };
    setImmediate(() => { void this.capture(meta, clone, latency); });
  }

  private fail(e: unknown) { this.errors++; try { this.o?.onError?.(e); } catch { /* ignore */ } }

  private shouldSample(rawUrl: string) {
    const u = new URL(rawUrl);
    if (this.o.endpoint && rawUrl.startsWith(this.o.endpoint)) return false;
    if (this.o.allowHosts) { if (!this.o.allowHosts.includes(u.host)) return false; }
    else if (PRIVATE.test(u.hostname) && !this.o.services) return false;
    return Math.random() < this.o.sampleRate;
  }

  private serviceOf(url: URL) {
    for (const [prefix, name] of Object.entries(this.o.services ?? {})) if (url.href.startsWith(prefix)) return name;
    return url.host;
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
      const batch = this.ready.splice(0, this.ready.length);
      for (const fp of batch) await this.send(fp);
    } catch (e) { this.fail(e); }
  }

  private async send(fp: unknown) {
    const body = gzipSync(new TextEncoder().encode(JSON.stringify(fp)));
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(`${this.o.endpoint}/v1/ingest`, {
          method: 'POST', body, signal: AbortSignal.timeout(3000),
          headers: { 'content-type': 'application/json', 'content-encoding': 'gzip', 'x-seismo-key': this.o.key },
        });
        if (r.ok || r.status < 500) return;
      } catch { /* retry once */ }
    }
    this.dropped++;
  }
}

export const seismo = new Seismo();
