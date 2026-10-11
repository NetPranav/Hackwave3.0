import Fastify from 'fastify';
import { SCENARIOS } from '@seismo/contracts';
import { ORDERS, PAYMENTS, SHIPMENTS, USERS } from './data.js';

type State = Record<string, { enabled: boolean; percent: number }>;
const fresh = (): State => Object.fromEntries(SCENARIOS.map((s) => [s.id, { enabled: false, percent: 100 }]));

interface Announcement { service: string; title: string; body: string; at: string }

export function buildServices() {
  const app = Fastify({ logger: false });
  const state = fresh();
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
      return reply.type('text/html').send(`<h1>${p} changelog</h1>${items.map((a) => `<article><h2>${a.title}</h2><time>${a.at}</time><p>${a.body}</p></article>`).join('')}`);
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
  app.post('/admin/reset', async () => {
    Object.assign(state, fresh());
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
