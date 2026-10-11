// Patterns from the real demo shop (fixtures/shop-wrapped is a copy of NetPranav/seismo-demo-shop's source).
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { scanDirectory } from '../src/scanner.js';

const map = scanDirectory(fileURLToPath(new URL('./fixtures/shop-wrapped', import.meta.url)), { repo: 'NetPranav/seismo-demo-shop', commit: 'c' });
const has = (field: string, usage: string, file: string) => map.fieldReads.some((r) => r.field === field && r.usage === usage && r.file === file);

describe('scanner on the demo shop (alias-wrapped clients)', () => {
  it('finds all five provider calls, none unresolved', () => {
    expect(map.callSites.filter((c) => !c.unresolved)).toHaveLength(5);
  });
  it('follows data through withAliases(await res.json(), ...)', () => expect(has('name', 'display', 'app/checkout/page.tsx')).toBe(true));
  it('follows into IMPORTED helpers: invoiceLines(user, payment) and shipmentLabel(status)', () => {
    expect(has('amount', 'display', 'lib/invoice.ts')).toBe(true);
    expect(map.fieldReads.some((r) => r.field === 'name' && r.file === 'lib/invoice.ts')).toBe(true);
    expect(has('status', 'branching', 'lib/api/shipping.ts')).toBe(true);
  });
  it('money arithmetic inside the client: amount * 1.18', () => expect(map.fieldReads.some((r) => r.field === 'amount' && r.usage === 'arithmetic' && r.money)).toBe(true));
  it('follows .slice(0, 20).map(o => o.id): array items are reads of data[]', () => {
    expect(has('data[].id', 'display', 'app/orders/page.tsx')).toBe(true);
    expect(map.fieldReads.some((r) => r.field.includes('slice'))).toBe(false);
  });
  it('value methods read the value: amount.toLocaleString() is a read of amount', () => expect(map.fieldReads.some((r) => r.field.includes('toLocaleString'))).toBe(false));
  it('three workflows from seismo.workflows.yml', () => expect(map.workflows.map((w) => w.id).sort()).toEqual(['checkout', 'invoice', 'orders']));
});
