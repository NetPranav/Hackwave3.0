import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { gunzipSync } from 'fflate';
import { Fingerprint } from '@seismo/contracts';
import { Seismo } from '../src/client.js';
import { formatOf, normalise } from '../src/classify.js';

const SECRETS = ['Priya Sharma', 'priya@example.com', 'SECRET-TOKEN-12345', '+919812345678', '4111111111111111'];
let api: http.Server, ingest: http.Server, apiUrl = '', ingestUrl = '';
const received: Record<string, unknown>[] = [];
const rawBodies: string[] = [];

beforeAll(async () => {
  api = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url?.startsWith('/payments')) {
      return res.end(JSON.stringify({ id: 'pay_8812', customer: { name: SECRETS[0], email: SECRETS[1], phone: SECRETS[3] }, card: SECRETS[4], token: SECRETS[2], amount: 49900, currency: 'INR', status: 'captured', items: [{ id: 'it_1' }, { id: 'it_2' }] }));
    }
    res.end(JSON.stringify({ ok: true }));
  }).listen(0);
  ingest = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const text = new TextDecoder().decode(gunzipSync(new Uint8Array(Buffer.concat(chunks))));
      rawBodies.push(text);
      received.push(JSON.parse(text));
      res.end('{"ok":true}');
    });
  }).listen(0);
  apiUrl = `http://localhost:${(api.address() as AddressInfo).port}`;
  ingestUrl = `http://localhost:${(ingest.address() as AddressInfo).port}`;
});
afterAll(() => { api.close(); ingest.close(); });

describe('classifiers', () => {
  it('format classes', () => {
    expect(formatOf('a@b.co')).toBe('email');
    expect(formatOf('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe('uuid');
    expect(formatOf('pay_8812')).toBe('prefixed_id');
    expect(formatOf('2026-10-14T13:58:02Z')).toBe('iso_date');
    expect(formatOf('captured')).toBe('enum_candidate');
    expect(formatOf('INR')).toBe('currency_code');
    expect(formatOf('Hello there, how are you?')).toBe('text');
  });
  it('endpoint normalisation', () => {
    const n = normalise(new URL('http://x/v1/users/8812/orders/pay_9?page=2&limit=50&expand=a'));
    expect(n.endpoint).toBe('/v1/users/{id}/orders/{id}');
    expect(n.queryKeys).toEqual(['expand', 'limit', 'page']);
    expect(n.limit).toBe(50);
  });
});

describe('SDK (P3.2/P3.3) privacy', () => {
  it('captures shapes, keeps the app response intact, and sends no record value', async () => {
    const s = new Seismo().init({ key: 'k', endpoint: ingestUrl, sampleRate: 1, services: { [apiUrl]: 'payments' }, enumAllowList: ['status', 'currency'], salt: 'customer-secret' });
    for (let i = 0; i < 6; i++) {
      const r = await fetch(`${apiUrl}/payments/pay_${8800 + i}?limit=20`);
      const body = await r.json(); // the app still reads the body normally
      expect(body.customer.name).toBe('Priya Sharma');
    }
    await new Promise((r) => setTimeout(r, 200));
    await s.flush();
    s.stop();

    expect(received.length).toBe(1);
    const fp = Fingerprint.parse(received[0]);
    expect(fp.service).toBe('payments');
    expect(fp.endpoint).toBe('/payments/{id}');
    expect(fp.count).toBe(6);
    expect(fp.reqLimit).toBe(20);
    expect(fp.fields['amount']!.types).toEqual({ integer: 6 });
    expect(fp.fields['amount']!.num).toBeUndefined();               // identical values -> never a percentile
    expect(fp.fields['amount']!.mag).toEqual({ '4': 6 });           // magnitude still shows rupees->paise shifts
    expect(fp.fields['customer.email']!.fmt).toEqual({ email: 6 });
    expect(fp.fields['status']!.enumValues).toEqual({ captured: 6 }); // allow-listed -> plain
    expect(fp.fields['items']!.arrayLen!.max).toBe(2);
    expect(fp.fields['items']!.idHashes!.length).toBe(2);

    const wire = rawBodies.join('\n');
    for (const secret of SECRETS) expect(wire).not.toContain(secret);
    expect(wire).not.toContain('customer-secret');                  // the salt never leaves
    expect(wire).not.toContain('"pay_88');                           // no ids
    expect(wire).not.toContain('49900');                             // no exact money value
  });

  it('holds back numbers below 5 values', async () => {
    received.length = 0;
    const s = new Seismo().init({ key: 'k', endpoint: ingestUrl, sampleRate: 1, services: { [apiUrl]: 'payments' } });
    for (let i = 0; i < 2; i++) await (await fetch(`${apiUrl}/payments/pay_1`)).json();
    await new Promise((r) => setTimeout(r, 150));
    await s.flush();
    s.stop();
    const fp = Fingerprint.parse(received[0]);
    expect(fp.fields['amount']!.num).toBeUndefined();
    expect(JSON.stringify(fp.fields['status'])).not.toContain('captured'); // not allow-listed -> hashed only
    expect(fp.fields['status']!.hashes).toBeTruthy();
  });
});

describe('batch percentiles', () => {
  it('are sent (rounded) only for >= 5 distinct values', async () => {
    const { observe, finish } = await import('../src/fingerprint.js');
    const accs = new Map<string, import('../src/fingerprint.js').FieldAcc>();
    const cfg = { salt: 's', enumAllowList: [], neverInspect: [], maxFields: 50, maxDepth: 5, maxArrayItems: 10 };
    for (const v of [101234, 250411, 399999, 48712, 7733, 90123]) observe({ price: v }, accs, cfg);
    const f = finish(accs).fields['price'] as { num: { p50: number } };
    expect(f.num.p50).toBeGreaterThan(0);
    expect(String(f.num.p50).replace(/0+$/, '').length).toBeLessThanOrEqual(4); // 3 significant figures
  });
});

describe('SDK fail-open (P3.8)', () => {
  it('app is unaffected when the backend is down', async () => {
    const errs: unknown[] = [];
    const s = new Seismo().init({ key: 'k', endpoint: 'http://localhost:1', sampleRate: 1, services: { [apiUrl]: 'payments' }, onError: (e) => errs.push(e) });
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) expect((await (await fetch(`${apiUrl}/other`)).json()).ok).toBe(true);
    const appMs = performance.now() - t0;
    await s.flush(); // fails silently
    s.stop();
    expect(appMs).toBeLessThan(2000);
    expect(s.dropped).toBeGreaterThan(0);
  });
  it('never throws on bad bodies', async () => {
    const bad = http.createServer((_q, r) => { r.setHeader('content-type', 'application/json'); r.end('{not json'); }).listen(0);
    const url = `http://localhost:${(bad.address() as AddressInfo).port}`;
    const s = new Seismo().init({ key: 'k', endpoint: ingestUrl, sampleRate: 1, services: { [url]: 'bad' } });
    const r = await fetch(`${url}/x`);
    expect(await r.text()).toBe('{not json');
    await new Promise((r2) => setTimeout(r2, 100));
    s.stop(); bad.close();
    expect(s.errors).toBeGreaterThan(0);
  });
});

describe('hostile field names', () => {
  it('__proto__ / constructor keys are skipped, not recorded', async () => {
    const { observe, finish } = await import('../src/fingerprint.js');
    const accs = new Map<string, import('../src/fingerprint.js').FieldAcc>();
    const cfg = { salt: 's', enumAllowList: [], neverInspect: [], maxFields: 50, maxDepth: 5, maxArrayItems: 10 };
    observe(JSON.parse('{"__proto__":{"x":1},"constructor":2,"ok":3}'), accs, cfg);
    const fields = finish(accs).fields;
    expect(Object.keys(fields)).toEqual(['ok']);
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
  });
});

describe('capture coverage (regression: keep-alive sockets opened before init)', () => {
  it('sees every fetch even when a keep-alive socket existed before init()', async () => {
    received.length = 0;
    await (await fetch(`${apiUrl}/payments/warm`)).text();             // socket opened before the SDK starts
    const s = new Seismo().init({ key: 'k', endpoint: ingestUrl, sampleRate: 1, services: { [apiUrl]: 'payments' } });
    for (let i = 0; i < 30; i++) await (await fetch(`${apiUrl}/payments/pay_${i}`)).text();
    await new Promise((r) => setTimeout(r, 150));
    await s.flush();
    s.stop();
    expect(received.reduce((n, fp) => n + Number((fp as { count: number }).count), 0)).toBe(30);
  });
  it('sees node:http calls (axios/got path) exactly once', async () => {
    received.length = 0;
    const s = new Seismo().init({ key: 'k', endpoint: ingestUrl, sampleRate: 1, services: { [apiUrl]: 'payments' } });
    for (let i = 0; i < 5; i++) await new Promise<void>((res) => http.get(`${apiUrl}/payments/p_${i}`, (r) => { r.resume(); r.on('end', () => res()); }));
    await new Promise((r) => setTimeout(r, 150));
    await s.flush();
    s.stop();
    expect(received.reduce((n, fp) => n + Number((fp as { count: number }).count), 0)).toBe(5);
  });
  it('stop() restores the original fetch; fetch errors propagate unchanged', async () => {
    const original = globalThis.fetch;
    const s = new Seismo().init({ key: 'k', endpoint: ingestUrl, sampleRate: 1 });
    expect(globalThis.fetch).not.toBe(original);
    await expect(fetch('http://127.0.0.1:1/x')).rejects.toThrow(TypeError);
    s.stop();
    expect(globalThis.fetch).toBe(original);
  });
});

describe('short prefixed ids', () => {
  it('o_1 / u_7 are ids, in_transit is an enum candidate', () => {
    expect(formatOf('o_1')).toBe('prefixed_id');
    expect(formatOf('u_7')).toBe('prefixed_id');
    expect(formatOf('in_transit')).toBe('enum_candidate');
  });
});

describe('webhook drift (P6.12)', () => {
  it('inbound webhook bodies are fingerprinted as service webhook:<provider>, values never sent', async () => {
    received.length = 0; rawBodies.length = 0;
    const s = new Seismo().init({ key: 'k', endpoint: ingestUrl, sampleRate: 1, enumAllowList: ['event'] });
    let handled = 0;
    const onCaptured = s.webhook('payments', 'payment.captured', (body: unknown) => { handled++; return (body as { amount: number }).amount; });
    for (let i = 0; i < 6; i++) expect(onCaptured({ event: 'payment.captured', payment_id: `pay_${i}`, amount: 49900 + i * 1000, customer_email: 'priya@example.com' })).toBe(49900 + i * 1000);
    await s.flush();
    s.stop();
    expect(handled).toBe(6);
    const fp = received.find((r) => (r as { service: string }).service === 'webhook:payments') as { endpoint: string; fields: Record<string, unknown> };
    expect(fp.endpoint).toBe('/webhooks/payment.captured');
    expect(Object.keys(fp.fields).sort()).toEqual(['amount', 'customer_email', 'event', 'payment_id']);
    expect(rawBodies.join('')).not.toMatch(/priya@example.com|pay_3|49900/);
  });
});

describe('SDK keeps seeing fetch when a framework replaces it (Next.js dev hot reload)', () => {
  it('re-wraps a replaced fetch on the next tick and never counts a call twice', async () => {
    received.length = 0;
    const original = globalThis.fetch;
    const s = new Seismo().init({ key: 'k', endpoint: ingestUrl, sampleRate: 1, services: { [apiUrl]: 'payments' }, flushMs: 60_000 });
    try {
      // 1) the framework puts the original fetch back: the SDK is blind until it re-wraps
      globalThis.fetch = original;
      await (await fetch(`${apiUrl}/payments/pay_1`)).json();
      s.rewrapIfReplaced();
      await (await fetch(`${apiUrl}/payments/pay_2`)).json();
      // 2) the framework wraps the SDK's wrapper: after re-wrapping there are two Seismo layers, still one record per call
      const ours = globalThis.fetch;
      globalThis.fetch = ((...a: Parameters<typeof fetch>) => ours(...a)) as typeof fetch;
      s.rewrapIfReplaced();
      await (await fetch(`${apiUrl}/payments/pay_3`)).json();
      await new Promise((r) => setTimeout(r, 100));
      await s.flush();
      const counted = received.map((r) => Fingerprint.parse(r)).reduce((n, f) => n + f.count, 0);
      expect(counted).toBe(2);                          // pay_2 and pay_3 once each; pay_1 happened while blind
    } finally {
      s.stop();
      globalThis.fetch = original;
    }
  });
});
