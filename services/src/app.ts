import Fastify from 'fastify';
import { SCENARIOS } from '@seismo/contracts';
import { ORDERS, PAYMENTS, SHIPMENTS, USERS } from './data.js';

type State = Record<string, { enabled: boolean; percent: number }>;
const fresh = (): State => Object.fromEntries(SCENARIOS.map((s) => [s.id, { enabled: false, percent: 100 }]));

interface Announcement { service: string; title: string; body: string; at: string }

/**
 * v2 demo: a change described by hand (the shop's demo panel form), applied to every response of one provider.
 *   rename: field -> to          type: field becomes a string / number     scale: field x factor
 *   remove: drop field           value: field becomes `value`               cap: lists cut to `max` items
 */
export interface CustomChange { id: string; service: 'users' | 'payments' | 'shipping' | 'orders'; kind: 'rename' | 'type' | 'scale' | 'remove' | 'value' | 'cap'; field: string; to?: string; factor?: number; value?: string; max?: number }
const FIELD = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const SERVICE_OF: Record<string, CustomChange['service']> = { users: 'users', payments: 'payments', shipments: 'shipping', orders: 'orders' };

export function validateChange(c: Partial<CustomChange>): string | undefined {
  if (!c.service || !Object.values(SERVICE_OF).includes(c.service)) return 'service must be users, payments, shipping or orders';
  if (!c.kind || !['rename', 'type', 'scale', 'remove', 'value', 'cap'].includes(c.kind)) return 'kind must be rename, type, scale, remove, value or cap';
  if (!c.field || !FIELD.test(c.field) || c.field === '__proto__') return 'field must be a plain field name';
  if (c.kind === 'rename' && (!c.to || !FIELD.test(c.to) || c.to === c.field)) return 'rename needs a new field name';
  if (c.kind === 'type' && c.to !== 'string' && c.to !== 'number') return 'type needs to: string or number';
  if (c.kind === 'scale' && !(typeof c.factor === 'number' && Number.isFinite(c.factor) && c.factor > 0 && c.factor !== 1)) return 'scale needs a factor (e.g. 100)';
  if (c.kind === 'value' && (typeof c.value !== 'string' || c.value.length > 64)) return 'value needs the new value';
  if (c.kind === 'cap' && !(Number.isInteger(c.max) && c.max! > 0)) return 'cap needs max (e.g. 100)';
  return undefined;
}

function applyToRecord(rec: Record<string, unknown>, c: CustomChange): Record<string, unknown> {
  if (!Object.prototype.hasOwnProperty.call(rec, c.field)) return rec;
  const out = { ...rec };
  const v = out[c.field];
  if (c.kind === 'rename') { delete out[c.field]; out[c.to!] = v; }
  else if (c.kind === 'remove') delete out[c.field];
  else if (c.kind === 'type') out[c.field] = c.to === 'string' ? (v === null ? v : String(v)) : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : v);
  else if (c.kind === 'scale') out[c.field] = typeof v === 'number' ? Math.round(v * c.factor! * 100) / 100 : v;
  else if (c.kind === 'value') out[c.field] = c.value;
  return out;
}

export function applyCustom(body: unknown, changes: CustomChange[]): unknown {
  let out = body;
  for (const c of changes) {
    if (!out || typeof out !== 'object' || Array.isArray(out)) continue;
    const o = out as Record<string, unknown>;
    if (c.kind === 'cap') {
      if (Array.isArray(o[c.field])) out = { ...o, [c.field]: (o[c.field] as unknown[]).slice(0, c.max) };
      continue;
    }
    out = Array.isArray(o['data']) ? { ...o, data: (o['data'] as unknown[]).map((r) => (r && typeof r === 'object' ? applyToRecord(r as Record<string, unknown>, c) : r)) } : applyToRecord(o, c);
  }
  return out;
}

export function buildServices() {
  const app = Fastify({ logger: false });
  // Admin buttons POST with content-type JSON and often no body: treat an empty body as {} instead of a 400.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body: string, done) => {
    try { done(null, body.trim() ? JSON.parse(body) : {}); } catch (e) { done(e as Error, undefined); }
  });
  const state = fresh();
  let custom: CustomChange[] = [];
  // custom changes (v2 demo panel) are applied to the provider's JSON on the way out, like a provider's own deploy would
  app.addHook('onSend', async (req, reply, payload) => {
    if (!custom.length || typeof payload !== 'string' || req.url.startsWith('/admin') || reply.statusCode >= 400) return payload;
    const service = SERVICE_OF[(req.url.split('?')[0] ?? '').split('/')[1] ?? ''];
    const mine = custom.filter((c) => c.service === service);
    if (!mine.length || !String(reply.getHeader('content-type') ?? '').includes('json')) return payload;
    try { return JSON.stringify(applyCustom(JSON.parse(payload), mine)); } catch { return payload; }
  });
  let announcements: Announcement[] = [];
  const token = process.env.DEMO_ADMIN_TOKEN ?? 'dev-admin';
  /** Is scenario `id` active for this request? Evaluated per request so rollout % gives mixed traffic. */
  const on = (id: string) => state[id]!.enabled && Math.random() * 100 < state[id]!.percent;
  const sc = (id: string) => ({ enabled: state[id]!.enabled, percent: state[id]!.percent });

  app.get('/health', async () => ({ ok: true }));

  // ---- users ----
  const user = (u: (typeof USERS)[number], v2: boolean) => {
    if (!v2) return u;
    const { name, ...rest } = u;
    return { ...rest, display_name: name };
  };
  app.get('/users/:id', async (req, reply) => {
    const u = USERS.find((x) => x.id === (req.params as { id: string }).id);
    if (!u) return reply.code(404).send(on('users-error-shape') ? { errors: [{ code: 'not_found', message: 'User not found' }] } : { error: 'not_found' });
    return user(u, on('users-rename'));
  });
  app.get('/users', async () => ({ data: USERS.map((u) => user(u, on('users-rename'))) }));

  // ---- payments ----
  const pay = (p: (typeof PAYMENTS)[number]) => {
    const paise = on('payments-paise');
    const n = paise ? p.rupees * 100 : p.rupees;
    const { rupees, ...rest } = p;
    void rupees;
    return { ...rest, amount: on('payments-amount-type') ? String(n) : n };
  };
  app.get('/payments/:id', async (req, reply) => {
    const p = PAYMENTS.find((x) => x.id === (req.params as { id: string }).id);
    return p ? pay(p) : reply.code(404).send({ error: 'not_found' });
  });
  app.post('/payments', async (req) => {
    const body = (req.body ?? {}) as { order_id?: string; rupees?: number };
    return pay({ id: 'pay_new', order_id: body.order_id ?? 'o_1', rupees: body.rupees ?? 499, currency: 'INR', status: 'captured' });
  });

  // ---- shipping ----
  app.get('/shipments/:id', async (req, reply) => {
    const s = SHIPMENTS.find((x) => x.id === (req.params as { id: string }).id);
    if (!s) return reply.code(404).send({ error: 'not_found' });
    if (on('shipping-deprecation')) {
      reply.header('Deprecation', 'true').header('Sunset', 'Wed, 30 Dec 2026 00:00:00 GMT');
    }
    const status = on('shipping-enum') && s.status === 'in_transit' ? 'partially_shipped' : s.status;
    return { ...s, status };
  });

  // ---- orders ----
  app.get('/orders', async (req) => {
    const q = req.query as { limit?: string; page?: string; cursor?: string };
    let limit = Math.min(Number(q.limit ?? 20) || 20, 500);
    if (on('orders-limit-cap')) limit = Math.min(limit, 100);
    if (on('orders-cursor')) {
      const start = Number(q.cursor ?? 0) || 0;
      const data = ORDERS.slice(start, start + limit);
      return { data, next_cursor: start + limit < ORDERS.length ? String(start + limit) : null };
    }
    const page = Math.max(Number(q.page ?? 1) || 1, 1);
    return { data: ORDERS.slice((page - 1) * limit, page * limit), page, total: ORDERS.length };
  });

  // ---- openapi + changelog (P1.3, feeds the radar in P7) ----
  const providers = ['users', 'payments', 'shipping', 'orders'] as const;
  const specs: Record<string, () => unknown> = {
    users: () => ({ '/users/{id}': { get: { fields: on('users-rename') ? ['id', 'display_name', 'email', 'phone'] : ['id', 'name', 'email', 'phone'] } } }),
    payments: () => ({ '/payments/{id}': { get: { amount: state['payments-paise']!.enabled ? 'integer paise' : 'integer rupees' } } }),
    shipping: () => ({ '/shipments/{id}': { get: { deprecated: state['shipping-deprecation']!.enabled } } }),
    orders: () => ({ '/orders': { get: { pagination: state['orders-cursor']!.enabled ? 'cursor' : 'page', maxLimit: state['orders-limit-cap']!.enabled ? 100 : 500 } } }),
  };
  for (const p of providers) {
    app.get(`/${p}/openapi.json`, async () => ({ openapi: '3.1.0', info: { title: `${p} (fake)`, version: '1' }, paths: specs[p]!() }));
    app.get(`/${p}/changelog`, async (req, reply) => {
      const items = announcements.filter((a) => a.service === p);
      if (String(req.headers.accept ?? '').includes('rss') || (req.query as { format?: string }).format === 'rss') {
        const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        return reply.type('application/rss+xml').send(`<?xml version="1.0"?><rss version="2.0"><channel><title>${p} changelog</title>${items.map((a) => `<item><title>${esc(a.title)}</title><description>${esc(a.body)}</description><pubDate>${new Date(a.at).toUTCString()}</pubDate></item>`).join('')}</channel></rss>`);
      }
      const h = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return reply.type('text/html').send(`<h1>${p} changelog</h1>${items.map((a) => `<article><h2>${h(a.title)}</h2><time>${a.at}</time><p>${h(a.body)}</p></article>`).join('')}`);
    });
  }

  // ---- admin ----
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/admin') && req.headers['x-admin-token'] !== token) return reply.code(401).send({ error: 'unauthorized' });
  });
  const known = (id: string) => SCENARIOS.some((s) => s.id === id);
  app.get('/admin/scenarios', async () => SCENARIOS.map((s) => ({ ...s, ...sc(s.id) })));
  app.post('/admin/scenarios/:id', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    if (!known(id)) return reply.code(404).send({ error: 'unknown_scenario' });
    const enabled = (req.body as { enabled?: boolean } | null)?.enabled ?? true;
    state[id] = { enabled, percent: enabled ? 100 : state[id]!.percent };
    return { ...state };
  });
  app.post('/admin/rollout/:id', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    if (!known(id)) return reply.code(404).send({ error: 'unknown_scenario' });
    state[id] = { enabled: true, percent: Math.min(100, Math.max(0, Number((req.body as { percent?: number })?.percent ?? 100))) };
    return { ...state };
  });
  app.get('/admin/custom', async () => custom);
  app.post('/admin/custom', async (req, reply) => {
    const c = (req.body ?? {}) as Partial<CustomChange>;
    const err = validateChange(c);
    if (err) return reply.code(400).send({ error: 'bad_change', message: err });
    if (custom.length >= 20) return reply.code(400).send({ error: 'too_many', message: 'at most 20 custom changes' });
    const change: CustomChange = { id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, service: c.service!, kind: c.kind!, field: c.field!, ...(c.to ? { to: c.to } : {}), ...(c.factor !== undefined ? { factor: c.factor } : {}), ...(c.value !== undefined ? { value: c.value } : {}), ...(c.max !== undefined ? { max: c.max } : {}) };
    custom = [...custom, change];
    return custom;
  });
  app.delete('/admin/custom/:id', async (req) => { custom = custom.filter((c) => c.id !== (req.params as { id: string }).id); return custom; });
  app.post('/admin/reset', async () => {
    Object.assign(state, fresh());
    custom = [];
    announcements = [];
    return { ...state };
  });
  app.post('/admin/announce', async (req) => {
    const b = req.body as { service: string; title: string; body?: string };
    announcements.push({ service: b.service, title: b.title, body: b.body ?? '', at: new Date().toISOString() });
    return { ok: true };
  });
  /** v1 or v2 payload of one scenario's endpoint regardless of toggles (feeds Compare). */
  app.get('/admin/sample/:endpoint', async (req, reply) => {
    const { endpoint } = req.params as { endpoint: string };
    const v2 = Number((req.query as { version?: string }).version) === 2;
    const saved = JSON.parse(JSON.stringify(state)) as State;
    for (const s of SCENARIOS) state[s.id] = { enabled: v2 && s.service === endpoint, percent: 100 };
    const path = ({ users: '/users/u_1', payments: '/payments/pay_1', shipping: '/shipments/sh_1', orders: '/orders?limit=3' } as Record<string, string>)[endpoint];
    try {
      if (!path) return reply.code(404).send({ error: 'unknown_endpoint' });
      return (await app.inject(path)).json();
    } finally {
      Object.assign(state, saved);
    }
  });
  return app;
}
