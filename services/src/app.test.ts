import { describe, expect, it } from 'vitest';
import { buildServices } from './app.js';

const h = { 'x-admin-token': 'dev-admin' };
describe('fake services', () => {
  it('v1 then v2 rename', async () => {
    const app = buildServices();
    expect((await app.inject('/users/1')).json()).toHaveProperty('email');
    await app.inject({ method: 'POST', url: '/admin/scenarios/users-rename', headers: h });
    expect((await app.inject('/users/1')).json()).toHaveProperty('emailAddress');
    await app.inject({ method: 'POST', url: '/admin/reset', headers: h });
    expect((await app.inject('/users/1')).json()).toHaveProperty('email');
  });
  it('payments units change x100', async () => {
    const app = buildServices();
    await app.inject({ method: 'POST', url: '/admin/scenarios/payments-paise', headers: h });
    expect((await app.inject({ method: 'POST', url: '/payments/charges' })).json().amount).toBe(49900);
  });
  it('admin needs token', async () => expect((await buildServices().inject('/admin/scenarios')).statusCode).toBe(401));
});
