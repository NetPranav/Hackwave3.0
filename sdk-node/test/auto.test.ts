import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { autoOptions } from '../src/auto.js';

describe('@seismo/sdk/auto (v3-P1.1)', () => {
  it('no SEISMO_KEY: does nothing', () => expect(autoOptions({}, '/nonexistent')).toBeUndefined());
  it('builds services, allowed hosts and enums from seismo.config.json + env', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seismo-auto-'));
    writeFileSync(join(dir, 'seismo.config.json'), JSON.stringify({ services: { STRIPE_API_URL: 'stripe', SHOP_API_URL: 'shop', 'SHOP_API_URL/orders': 'orders', MISSING_URL: 'x' }, enumAllowList: ['status'], ignore: ['SHOP_API_URL/admin'] }));
    const o = autoOptions({ SEISMO_KEY: 'k', SEISMO_ENDPOINT: 'https://seismo.example', SEISMO_SAMPLE_RATE: '0.5', STRIPE_API_URL: 'https://api.stripe.com/', SHOP_API_URL: 'http://localhost:4100' }, dir)!;
    expect(o).toEqual({
      key: 'k', endpoint: 'https://seismo.example', sampleRate: 0.5,
      services: { 'https://api.stripe.com': 'stripe', 'http://localhost:4100': 'shop', 'http://localhost:4100/orders': 'orders' },
      allowHosts: ['api.stripe.com', 'localhost:4100'], enumAllowList: ['status'], ignore: ['http://localhost:4100/admin'],
    });
  });
  it('a broken config file never throws', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seismo-auto-'));
    writeFileSync(join(dir, 'seismo.config.json'), '{ not json');
    expect(autoOptions({ SEISMO_KEY: 'k' }, dir)).toEqual({ key: 'k' });
  });
});
