import { describe, expect, it } from 'vitest';
import type { DriftEvent } from '@seismo/contracts';
import { AiExplanation } from '@seismo/contracts';
import { NimClient, RateLimiter } from '../src/ai/nim.js';
import { AiService, promptFacts } from '../src/ai/service.js';
import { suggestionFor, templateExplanation } from '../src/ai/templates.js';

const ev = (over: Partial<DriftEvent> = {}): DriftEvent => ({
  id: 'drift-1', service: 'payments', endpoint: 'GET /payments/{id}', field: 'amount', detector: 'D5', title: 'Unit change: amount ×100',
  severity: 'breaking', state: 'breaking', confidence: 0.98, detectedAt: '2026-10-14T10:00:00.000Z',
  before: { magnitudes: { '2': 40 } }, after: { magnitudes: { '4': 40 }, factor: 100 },
  usages: [{ file: 'lib/api/payments.ts', line: 17, kind: 'arithmetic+money' }, { file: 'lib/invoice.ts', line: 8, kind: 'display' }], ...over,
});
const GOOD = { title: 'Payments amount is now in paise (×100)', summary: 'The payments API now returns amount in paise, 100 times the rupee value.', impact: 'Checkout total and invoice show ₹49,900 instead of ₹499.', recommendation: 'Divide amount by 100 in the payments adapter after confirming with the provider.', risk: 'high', channels: { whatsapp: 'Seismo: payments amount ×100 (paise). Checkout totals are wrong. Review now.', slack: '*payments amount ×100*', emailSubject: 'Payments amount ×100', emailBody: 'The payments API now returns paise.' } };

/** Fake NIM: returns queued replies, records requests. */
function fakeNim(replies: (object | string | number)[]) {
  const calls: { body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    calls.push({ body: JSON.parse(String(init.body)) });
    const r = replies.shift() ?? GOOD;
    if (typeof r === 'number') return new Response('err', { status: r });
    const content = typeof r === 'string' ? r : JSON.stringify(r);
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { calls, client: new NimClient({ apiKey: 'test', baseUrl: 'http://nim', fetchImpl, perMinute: 1000 }) };
}

describe('AI layer (P6.5): explains, never decides', () => {
  it('valid JSON -> AI explanation with model + latency, validated by the contract', async () => {
    const { client, calls } = fakeNim([GOOD]);
    const x = await new AiService({ client }).explain(ev());
    expect(AiExplanation.parse(x).source).toBe('ai');
    expect(x.title).toContain('paise');
    expect(calls[0]!.body['response_format']).toMatchObject({ type: 'json_schema' });
  });
  it('invalid JSON / wrong shape is retried with the error, then accepted', async () => {
    const { client, calls } = fakeNim(['not json', { title: 'x' }, GOOD]);
    const x = await new AiService({ client }).explain(ev());
    expect(x.source).toBe('ai');
    expect(calls).toHaveLength(3);
    expect(JSON.stringify(calls[2]!.body['messages'])).toContain('did not match the schema');
  });
  it('three bad answers, a 4xx, or no key -> template (the product still works)', async () => {
    expect((await new AiService({ client: fakeNim(['x', 'y', 'z']).client }).explain(ev())).source).toBe('template');
    expect((await new AiService({ client: fakeNim([401]).client }).explain(ev())).source).toBe('template');
    expect((await new AiService({ client: new NimClient({ apiKey: '' }) }).explain(ev())).source).toBe('template');
  });
  it('WhatsApp text over 300 chars is rejected by validation (retry), never sent as is', async () => {
    const long = { ...GOOD, channels: { ...GOOD.channels, whatsapp: 'x'.repeat(301) } };
    const { client, calls } = fakeNim([long, long, long]);
    const x = await new AiService({ client }).explain(ev());
    expect(calls).toHaveLength(3);
    expect(x.source).toBe('template');
    expect(x.channels.whatsapp.length).toBeLessThanOrEqual(300);
  });
  it('cache: the same change is explained once', async () => {
    const { client, calls } = fakeNim([GOOD, GOOD]);
    const ai = new AiService({ client });
    await ai.explain(ev()); await ai.explain(ev({ id: 'drift-2', state: 'suspected' }));
    expect(calls).toHaveLength(1);
  });
  it('every model call is reported for the live feed: start, done (with latency), then cached; failures too', async () => {
    const seen: string[] = [];
    const ai = new AiService({ client: fakeNim([GOOD, GOOD]).client, onCall: (c) => seen.push(c.phase + ':' + c.task) });
    await ai.explain(ev()); await ai.explain(ev({ id: 'drift-2' }));
    expect(seen).toEqual(['start:explain', 'done:explain', 'cached:explain']);
    const bad: string[] = [];
    await new AiService({ client: fakeNim(['x', 'y', 'z']).client, onCall: (c) => bad.push(c.phase) }).explain(ev());
    expect(bad).toEqual(['start', 'failed']);
  });
  it('prompt carries statistics, paths and code locations only: no response values', () => {
    const facts = JSON.stringify(promptFacts(ev()));
    expect(facts).toContain('lib/api/payments.ts');
    expect(facts).not.toMatch(/49900|Asha|@example/);
  });
  it('enum judge: may only choose a known label; anything else is discarded', async () => {
    const d7 = ev({ detector: 'D7', field: 'status', title: 'New status value: partially_shipped', before: { values: ['in_transit', 'delivered'] }, after: { added: [{ value: 'partially_shipped', share: 1 }], vanished: [] } });
    const ok = await new AiService({ client: fakeNim([{ choice: 'in_transit', confidence: 0.62, reason: 'partly shipped is still moving' }]).client }).judgeEnum(d7);
    expect(ok).toEqual({ choice: 'in_transit', confidence: 0.62, reason: 'partly shipped is still moving' });
    const bad = await new AiService({ client: fakeNim([{ choice: 'refunded', confidence: 0.9, reason: 'made up' }]).client }).judgeEnum(d7);
    expect(bad).toBeUndefined();
  });
  it('rate limiter holds the request rate under the cap', async () => {
    let t = 0;
    const rl = new RateLimiter(2, () => t);
    await rl.take(); await rl.take();
    let third = false;
    const p = rl.take().then(() => { third = true; });
    await new Promise((r) => setTimeout(r, 80));
    expect(third).toBe(false);
    t = 61_000;
    await p;
    expect(third).toBe(true);
  });
});

describe('template catalog (P6.6): fixed text, never generated, never executed', () => {
  it('limit cap -> paginate instruction at the call site', () => {
    const s = suggestionFor(ev({ detector: 'D9', field: 'data', title: 'Silent truncation: asked 500, got exactly 100 in 100% of calls', after: { maxLength: 100, shareAtMax: 1, limitAsked: 500 }, usages: [{ file: 'lib/api/orders.ts', line: 4, kind: 'call' }] }));
    expect(s).toContain('at most 100 items');
    expect(s).toContain('lib/api/orders.ts:4');
  });
  it('unit change -> divide by the factor, money never automatic', () => {
    const s = suggestionFor(ev());
    expect(s).toContain('divide amount by 100');
    expect(s).toContain('never fixed automatically');
  });
  it('every detector has a template that fits every channel limit', () => {
    for (const d of ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D14', 'D16', 'D17', 'DX']) {
      const x = templateExplanation(ev({ detector: d, title: `${d} title that is long enough` }));
      expect(() => AiExplanation.parse({ ...x, confidence: 1, model: 'template', latencyMs: 0, source: 'template' }), d).not.toThrow();
    }
  });
});

describe.runIf(process.env.LIVE_NIM === '1' && !!process.env.NIM_API_KEY)('LIVE: real NVIDIA NIM', () => {
  it('explains the paise change with valid JSON from the real model', async () => {
    const ai = new AiService();
    const x = await ai.explain(ev());
    console.log('LIVE NIM', x.source, x.model, `${x.latencyMs} ms`, '|', x.title, '|', x.channels.whatsapp);
    expect(x.source).toBe('ai');
    expect(AiExplanation.parse(x)).toBeTruthy();
  });
});
