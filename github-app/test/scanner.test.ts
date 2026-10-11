import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { CodeMap } from '@seismo/contracts';
import { scanDirectory } from '../src/scanner.js';

const dir = fileURLToPath(new URL('./fixtures/shop', import.meta.url));
const map = scanDirectory(dir, { repo: 'demo/shop', commit: 'abc' });
const reads = (service: string, endpoint: string) => {
  const ids = new Set(map.callSites.filter((c) => c.service === service && c.endpoint === endpoint).map((c) => c.id));
  return map.fieldReads.filter((r) => ids.has(r.callSiteId));
};
const find = (service: string, endpoint: string, field: string) => reads(service, endpoint).find((r) => r.field === field);

describe('scanner on the fixture shop', () => {
  it('output matches the contract', () => expect(CodeMap.parse(map)).toBeTruthy());
  it('finds every provider call with templated endpoints', () => {
    const eps = map.callSites.map((c) => `${c.method} ${c.service} ${c.endpoint}`);
    expect(eps).toContain('GET users /users/{id}');
    expect(eps).toContain('GET shipping /shipments/{id}');
    expect(eps).toContain('GET orders /orders');
    expect(eps).toContain('POST payments /payments');
    expect(eps).toContain('GET payments /payments/{id}');
  });
  it('reports unresolvable calls instead of hiding them', () => {
    const u = map.callSites.filter((c) => c.unresolved);
    expect(u).toHaveLength(1);
    expect(u[0]!.file).toBe('lib/api.ts');
  });
  it('follows returned data to callers: user.name is displayed in checkout', () => {
    expect(find('users', '/users/{id}', 'name')?.usage).toBe('display');
    expect(find('users', '/users/{id}', 'email')?.usage).toBe('display');
    expect(find('users', '/users/{id}', 'phone')).toBeTruthy();
  });
  it('payments amount is arithmetic + money and persisted', () => {
    const a = reads('payments', '/payments').filter((r) => r.field === 'amount');
    expect(a.some((r) => r.usage === 'arithmetic' && r.money)).toBe(true);
    expect(a.some((r) => r.usage === 'persistence' && r.money)).toBe(true);
    expect(find('payments', '/payments', 'status')).toBeTruthy();
  });
  it('Number(r.data.amount) is arithmetic', () => expect(find('payments', '/payments/{id}', 'amount')?.usage).toBe('arithmetic'));
  it('shipment status is a branching read', () => expect(reads('shipping', '/shipments/{id}').some((r) => r.field === 'status' && r.usage === 'branching')).toBe(true));
  it('follows array callbacks: orders data[].total_rupees', () => {
    const f = reads('orders', '/orders').map((r) => r.field);
    expect(f.some((x) => x.endsWith('total_rupees'))).toBe(true);
    expect(f.some((x) => x.endsWith('.id') || x === 'id')).toBe(true);
  });
  it('workflows come from seismo.workflows.yml', () => {
    const wf = map.workflows.find((w) => w.id === 'checkout')!;
    expect(wf.globs).toContain('app/checkout/**');
  });
});
