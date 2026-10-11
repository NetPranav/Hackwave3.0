import { describe, expect, it } from 'vitest';
import { buildServices } from './app.js';

const h = { 'x-admin-token': 'dev-admin' };
const post = (app: ReturnType<typeof buildServices>, url: string, payload?: object) => app.inject({ method: 'POST', url, headers: h, payload });

describe('fake services', () => {
  it('users rename toggles and resets', async () => {
    const app = buildServices();
    expect((await app.inject('/users/u_1')).json()).toHaveProperty('name');
    await post(app, '/admin/scenarios/users-rename');
    const v2 = (await app.inject('/users/u_1')).json();
    expect(v2).toHaveProperty('display_name');
    expect(v2).not.toHaveProperty('name');
    await post(app, '/admin/reset');
    expect((await app.inject('/users/u_1')).json()).toHaveProperty('name');
  });
  it('payments paise is x100 and amount type can change', async () => {
    const app = buildServices();
    await post(app, '/admin/scenarios/payments-paise');
    expect((await app.inject('/payments/pay_1')).json().amount).toBe(49900);
    await post(app, '/admin/scenarios/payments-amount-type');
    expect((await app.inject('/payments/pay_1')).json().amount).toBe('49900');
  });
  it('orders limit is silently capped at 100', async () => {
    const app = buildServices();
    expect((await app.inject('/orders?limit=500')).json().data).toHaveLength(500);
    await post(app, '/admin/scenarios/orders-limit-cap');
    expect((await app.inject('/orders?limit=500')).json().data).toHaveLength(100);
  });
  it('shipping deprecation sets headers', async () => {
    const app = buildServices();
    await post(app, '/admin/scenarios/shipping-deprecation');
    const r = await app.inject('/shipments/sh_1');
    expect(r.headers.sunset).toBeTruthy();
    expect(r.headers.deprecation).toBe('true');
  });
  it('rollout 50% gives mixed responses', async () => {
    const app = buildServices();
    await post(app, '/admin/rollout/users-rename', { percent: 50 });
    const kinds = new Set<string>();
    for (let i = 0; i < 60; i++) kinds.add(Object.keys((await app.inject('/users/u_1')).json()).includes('name') ? 'v1' : 'v2');
    expect(kinds.size).toBe(2);
  });
  it('sample returns v1/v2 regardless of toggles, then restores state', async () => {
    const app = buildServices();
    expect((await app.inject({ url: '/admin/sample/users?version=2', headers: h })).json()).toHaveProperty('display_name');
    expect((await app.inject('/users/u_1')).json()).toHaveProperty('name');
  });
  it('changelog accepts an announcement and openapi reflects toggles', async () => {
    const app = buildServices();
    await post(app, '/admin/announce', { service: 'payments', title: 'Amounts move to paise', body: 'On 2026-12-01' });
    expect((await app.inject('/payments/changelog')).body).toContain('Amounts move to paise');
    expect((await app.inject('/payments/changelog?format=rss')).body).toContain('<item>');
    await post(app, '/admin/scenarios/payments-paise');
    expect((await app.inject('/payments/openapi.json')).body).toContain('paise');
  });
  it('reset works with content-type JSON and an empty body (Demo Control button)', async () => {
    const app = buildServices();
    await post(app, '/admin/scenarios/users-rename');
    const r = await app.inject({ method: 'POST', url: '/admin/reset', headers: { ...h, 'content-type': 'application/json' } });
    expect(r.statusCode).toBe(200);
    expect((await app.inject('/users/u_1')).json()).toHaveProperty('name');
  });
  it('admin needs token', async () => expect((await buildServices().inject('/admin/scenarios')).statusCode).toBe(401));
});

describe('custom changes (v2 demo panel form)', () => {
  const h = { 'x-admin-token': process.env.DEMO_ADMIN_TOKEN ?? 'dev-admin', 'content-type': 'application/json' };
  it('rename / type / value / cap apply to that provider only; invalid input is rejected; reset clears them', async () => {
    const app = buildServices();
    const add = (c: object) => app.inject({ method: 'POST', url: '/admin/custom', headers: h, payload: JSON.stringify(c) });
    expect((await add({ service: 'users', kind: 'rename', field: 'email', to: 'mail' })).statusCode).toBe(200);
    expect((await add({ service: 'payments', kind: 'type', field: 'amount', to: 'string' })).statusCode).toBe(200);
    expect((await add({ service: 'shipping', kind: 'value', field: 'status', value: 'lost' })).statusCode).toBe(200);
    expect((await add({ service: 'orders', kind: 'cap', field: 'data', max: 7 })).statusCode).toBe(200);
    expect((await add({ service: 'users', kind: 'rename', field: '__proto__', to: 'x' })).statusCode).toBe(400);
    expect((await add({ service: 'nope', kind: 'remove', field: 'a' })).statusCode).toBe(400);
    const u = (await app.inject('/users/u_1')).json();
    expect(u.mail).toBe('asha.rao@example.in');
    expect(u.email).toBeUndefined();
    expect(typeof (await app.inject('/payments/pay_1')).json().amount).toBe('string');
    expect((await app.inject('/shipments/sh_1')).json().status).toBe('lost');
    expect((await app.inject('/orders?limit=50')).json().data).toHaveLength(7);
    expect((await app.inject('/users/missing')).json()).toEqual({ error: 'not_found' });   // errors untouched
    await app.inject({ method: 'POST', url: '/admin/reset', headers: h });
    expect((await app.inject('/users/u_1')).json().email).toBe('asha.rao@example.in');
  });
});
