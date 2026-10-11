import Fastify from 'fastify';
import { SCENARIOS, type Scenario } from '@seismo/contracts';

type Name = Scenario['service'];
const NAMES: Name[] = ['users', 'payments', 'shipping', 'orders'];

/** Payloads per service. v2 applies the silent change from SCENARIOS (docs/roadmap/P1). */
const payload = {
  users: (v: 1 | 2, id: string) => (v === 1 ? { id, name: 'Asha Rao', email: 'asha@example.com' } : { id, name: 'Asha Rao', emailAddress: 'asha@example.com' }),
  payments: (v: 1 | 2) => ({ id: 'ch_1', currency: 'INR', amount: v === 1 ? 499 : 49900, status: 'succeeded' }),
  shipping: (v: 1 | 2) => ({ id: 'sh_1', status: v === 1 ? 'in_transit' : 'out_for_delivery' }),
  orders: (v: 1 | 2, limit: number) => {
    const cap = v === 1 ? limit : Math.min(limit, 100);
    return { data: Array.from({ length: Math.min(cap, 500) }, (_, i) => ({ id: `o_${i}`, total: 499 })) };
  },
};

export function buildServices() {
  const app = Fastify({ logger: false });
  const versions: Record<Name, 1 | 2> = { users: 1, payments: 1, shipping: 1, orders: 1 };
  const rollout: Record<Name, number> = { users: 100, payments: 100, shipping: 100, orders: 100 };
  const token = process.env.DEMO_ADMIN_TOKEN ?? 'dev-admin';
  const ver = (n: Name): 1 | 2 => (versions[n] === 2 && Math.random() * 100 < rollout[n] ? 2 : 1);

  app.get('/health', async () => ({ ok: true }));
  app.get('/users/:id', async (req) => payload.users(ver('users'), (req.params as { id: string }).id));
  app.post('/payments/charges', async () => payload.payments(ver('payments')));
  app.get('/shipping/:id', async () => payload.shipping(ver('shipping')));
  app.get('/orders', async (req) => payload.orders(ver('orders'), Number((req.query as { limit?: string }).limit ?? 20)));

  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/admin') && req.headers['x-admin-token'] !== token) return reply.code(401).send({ error: 'unauthorized' });
  });
  app.get('/admin/scenarios', async () => SCENARIOS);
  app.post('/admin/scenarios/:id', async (req, reply) => {
    const s = SCENARIOS.find((x) => x.id === (req.params as { id: string }).id);
    if (!s) return reply.code(404).send({ error: 'unknown_scenario' });
    versions[s.service] = 2; rollout[s.service] = 100;
    return { ...versions };
  });
  app.post('/admin/rollout/:id', async (req, reply) => {
    const s = SCENARIOS.find((x) => x.id === (req.params as { id: string }).id);
    if (!s) return reply.code(404).send({ error: 'unknown_scenario' });
    versions[s.service] = 2; rollout[s.service] = Number((req.body as { percent?: number })?.percent ?? 100);
    return { ...versions };
  });
  app.post('/admin/reset', async () => { for (const n of NAMES) { versions[n] = 1; rollout[n] = 100; } return { ...versions }; });
  app.get('/admin/sample/:endpoint', async (req) => {
    const { endpoint } = req.params as { endpoint: Name };
    const v = (Number((req.query as { version?: string }).version) === 2 ? 2 : 1) as 1 | 2;
    return endpoint === 'users' ? payload.users(v, 'u_1') : endpoint === 'orders' ? payload.orders(v, 3) : payload[endpoint](v);
  });
  return app;
}
