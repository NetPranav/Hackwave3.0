import { describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { CodeMap, DriftEvent, NotificationSettings } from '@seismo/contracts';
import { Compare, SimulateResult } from '@seismo/contracts';
import { buildServices } from '../../services/src/app.js';
import { Dispatcher } from '../src/alerts/dispatcher.js';
import { AiService } from '../src/ai/service.js';
import { NimClient } from '../src/ai/nim.js';
import { compare, simulate, synthesize } from '../src/compare.js';
import { buildBaselines } from '../src/baseline.js';
import { buildApp } from '../src/app.js';
import { memorySettings } from '../src/settings-store.js';
import { capture, toggle } from './helpers.js';

const ev = (over: Partial<DriftEvent> = {}): DriftEvent => ({ id: 'drift-9', service: 'payments', endpoint: 'GET /payments/{id}', field: 'amount', detector: 'D5', title: 'Unit change: amount ×100', severity: 'breaking', state: 'breaking', confidence: 0.98, detectedAt: '2026-10-14T10:00:00.000Z', before: null, after: null, usages: [{ file: 'lib/api/payments.ts', line: 17, kind: 'arithmetic+money' }], ...over });
const tpl = new AiService({ client: new NimClient({ apiKey: '' }) });

/** One local HTTP server that plays Twilio, Resend, Slack and Discord and records every request. */
async function sinks() {
  const got: { path: string; auth?: string; body: string }[] = [];
  const srv = http.createServer((q, r) => { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { got.push({ path: q.url ?? '', auth: q.headers.authorization, body: b }); r.statusCode = q.url?.includes('fail') ? 500 : 200; r.end('{}'); }); }).listen(0);
  await new Promise((r) => srv.once('listening', r));
  const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  return { got, url, close: () => srv.close() };
}
const settings = (url: string, over: Partial<NotificationSettings> = {}): NotificationSettings => ({
  whatsapp: { enabled: true, to: '+919800000000' }, slack: { enabled: true, webhookUrl: `${url}/slack` }, discord: { enabled: true, webhookUrl: `${url}/discord` },
  email: { enabled: true, to: 'lead@example.com' }, github: { enabled: true }, minSeverity: 'warning', aiEnabled: false, ...over,
});

describe('alert dispatcher (P6.7)', () => {
  it('breaking event -> WhatsApp, Slack, Discord, email, GitHub issue, dashboard; exactly once each', async () => {
    const s = await sinks();
    const issues: unknown[] = [];
    const d = new Dispatcher({ settings: async () => settings(s.url), twilio: { accountSid: 'AC1', authToken: 'tok', from: 'whatsapp:+14155238886', baseUrl: s.url }, resend: { apiKey: 're_1', baseUrl: s.url }, github: { upsertIssue: async (i) => { issues.push(i); return { url: 'u' }; } }, dashboardUrl: 'https://seismo.example' });
    const e = ev();
    await d.dispatch(e, tpl.template(e), 'NetPranav/seismo-demo-shop');
    await d.dispatch(e, tpl.template(e), 'NetPranav/seismo-demo-shop');          // second pass: nothing new
    s.close();
    expect(d.log.map((n) => n.channel).sort()).toEqual(['dashboard', 'discord', 'email', 'github', 'slack', 'whatsapp']);
    expect(d.log.every((n) => n.ok)).toBe(true);
    const wa = s.got.find((g) => g.path.includes('/Messages.json'))!;
    expect(wa.auth).toBe(`Basic ${Buffer.from('AC1:tok').toString('base64')}`);
    expect(decodeURIComponent(wa.body)).toContain('To=whatsapp:+919800000000');
    expect(s.got.find((g) => g.path === '/emails')!.auth).toBe('Bearer re_1');
    expect(issues).toHaveLength(1);
  });
  it('WhatsApp is breaking-only by default; info never alerts anywhere but the dashboard', async () => {
    const s = await sinks();
    const d = new Dispatcher({ settings: async () => settings(s.url), twilio: { accountSid: 'AC1', authToken: 't', from: 'w', baseUrl: s.url }, resend: { apiKey: 'k', baseUrl: s.url } });
    await d.dispatch(ev({ id: 'w1', severity: 'warning', state: 'suspected' }), tpl.template(ev()));
    await d.dispatch(ev({ id: 'i1', severity: 'info', state: 'normal' }), tpl.template(ev()));
    s.close();
    expect(d.log.filter((n) => n.driftId === 'w1').map((n) => n.channel).sort()).toEqual(['dashboard', 'discord', 'email', 'slack']);
    expect(d.log.filter((n) => n.driftId === 'i1')).toEqual([]);
  });
  it('a failing channel is logged and retried next time; the others still go out', async () => {
    const s = await sinks();
    const d = new Dispatcher({ settings: async () => settings(s.url, { slack: { enabled: true, webhookUrl: `${s.url}/fail` } }), twilio: { accountSid: 'A', authToken: 't', from: 'w', baseUrl: s.url }, resend: { apiKey: 'k', baseUrl: s.url } });
    await d.dispatch(ev(), tpl.template(ev()));
    expect(d.log.find((n) => n.channel === 'slack')!.ok).toBe(false);
    expect(d.log.find((n) => n.channel === 'email')!.ok).toBe(true);
    await d.dispatch(ev(), tpl.template(ev()));
    s.close();
    expect(d.log.filter((n) => n.channel === 'slack')).toHaveLength(2);       // retried once more
    expect(d.log.filter((n) => n.channel === 'email')).toHaveLength(1);       // not duplicated
  });
  it('the GitHub issue follows the event: opened, fix pending, resolved', async () => {
    const states: string[] = [];
    const d = new Dispatcher({ settings: async () => settings('http://x', { whatsapp: { enabled: false }, slack: { enabled: false }, discord: { enabled: false }, email: { enabled: false } }), github: { upsertIssue: async (i) => { states.push(i.state); return { url: 'u' }; } } });
    for (const state of ['breaking', 'fix_pending', 'resolved'] as const) await d.dispatch(ev({ state }), tpl.template(ev()), 'o/r');
    expect(states).toEqual(['breaking', 'fix_pending', 'resolved']);
  });
  it('missing Twilio credentials -> clear error in the log, no crash', async () => {
    const d = new Dispatcher({ settings: async () => settings('http://x', { slack: { enabled: false }, discord: { enabled: false }, email: { enabled: false } }), twilio: { accountSid: '', authToken: '', from: '' } });
    await d.dispatch(ev(), tpl.template(ev()));
    expect(d.log.find((n) => n.channel === 'whatsapp')!.error).toContain('Twilio is not configured');
  });
});

const T0 = Date.parse('2026-10-14T10:00:00Z');
const map: CodeMap = {
  repo: 'NetPranav/seismo-demo-shop', commit: 'c', scannedAt: '2026-10-14T10:00:00.000Z',
  callSites: [{ id: 'p', repo: 'NetPranav/seismo-demo-shop', file: 'lib/api/payments.ts', line: 7, service: 'payments', method: 'GET', endpoint: '/payments/{id}' }, { id: 'o', repo: 'NetPranav/seismo-demo-shop', file: 'lib/api/orders.ts', line: 4, service: 'orders', method: 'GET', endpoint: '/orders' }],
  fieldReads: [{ callSiteId: 'p', field: 'amount', file: 'lib/invoice.ts', line: 8, usage: 'display', money: false }, { callSiteId: 'p', field: 'amount', file: 'lib/api/payments.ts', line: 17, usage: 'arithmetic', money: true }, { callSiteId: 'o', field: 'data[].total_rupees', file: 'app/orders/page.tsx', line: 7, usage: 'arithmetic', money: true }],
  workflows: [{ id: 'checkout', name: 'checkout', file: '', functions: [], globs: ['lib/api/payments.ts'] }, { id: 'invoice', name: 'invoice', file: '', functions: [], globs: ['lib/invoice.ts'] }],
};

describe('Compare & Simulate (P6.10)', () => {
  it('compare shows a synthetic before/after and the magnitude diff for paise (no real values)', async () => {
    const s = buildServices();
    const fps = [...(await capture(s, '/payments/pay_1', 40, { service: 'payments', at: T0 }))];
    await toggle(s, 'payments-paise');
    fps.push(...(await capture(s, '/payments/pay_1', 40, { service: 'payments', at: T0 + 600_000 })));
    const c = Compare.parse(compare(fps, 'payments', 'GET /payments/{id}', 60_000, T0 + 610_000));
    expect(c.diff).toContainEqual({ path: 'amount', change: 'magnitude', before: '10^2', after: '10^4' });
    expect(c.v1).toMatchObject({ amount: 100, currency: 'XXX', status: 'captured' });   // currency is not allow-listed in this test: format class only
    expect(JSON.stringify(c)).not.toMatch(/499|49900/);
  });
  it('synthesize builds nested arrays from paths', () => {
    const s = buildServices();
    return capture(s, '/orders?limit=3', 3, { service: 'orders', at: T0 }).then((fps) => {
      expect(synthesize(buildBaselines(fps)[0])).toMatchObject({ data: [{ id: 'id_123', total_rupees: 100 }] });
    });
  });
  it('simulate: units on a money field -> breaking, review, affected workflows listed', () => {
    const r = SimulateResult.parse(simulate({ service: 'payments', endpoint: 'GET /payments/{id}', scenario: { kind: 'units', field: 'amount', factor: 100 } }, [map]));
    expect(r).toMatchObject({ detector: 'D5', severity: 'breaking', fixRung: 'behaviour' });
    expect(r.workflows.sort()).toEqual(['checkout', 'invoice']);
    expect(r.explanation).toContain('never an automatic fix');
  });
  it('simulate: rename -> alias-eligible; limit -> review with the paginate template; unread field -> info', () => {
    expect(simulate({ service: 'payments', endpoint: 'GET /payments/{id}', scenario: { kind: 'rename', field: 'amount', to: 'amount_paise' } }, [map]).fixRung).toBe('alias');
    const lim = simulate({ service: 'orders', endpoint: 'GET /orders', scenario: { kind: 'limit', field: 'data', max: 100 } }, [map]);
    expect(lim.explanation).toContain('at most 100 items');
    expect(simulate({ service: 'payments', endpoint: 'GET /payments/{id}', scenario: { kind: 'remove', field: 'nobody_reads_this' } }, [map]).severity).toBe('info');
  });
});

describe('review actions + settings API (P6.6, P6.13)', () => {
  it('settings round-trip and validation; test-send goes through the dispatcher', async () => {
    const s = await sinks();
    const store = memorySettings(settings(s.url, { whatsapp: { enabled: false }, discord: { enabled: false }, email: { enabled: false } }));
    const app = buildApp({ settings: store, dispatcher: new Dispatcher({ settings: () => store.get() }) });
    expect((await app.inject({ method: 'PUT', url: '/v1/settings/notifications', payload: { nope: 1 } })).statusCode).toBe(400);
    const next = { ...(await store.get()), minSeverity: 'breaking' as const };
    expect((await app.inject({ method: 'PUT', url: '/v1/settings/notifications', payload: next })).json().minSeverity).toBe('breaking');
    const sent = (await app.inject({ method: 'POST', url: '/v1/notifications/test' })).json().sent as { channel: string; ok: boolean }[];
    s.close();
    expect(sent.find((n) => n.channel === 'slack')!.ok).toBe(true);
    expect((await app.inject('/v1/notifications')).json().length).toBeGreaterThan(0);
  });
  it('review actions validate input and unknown ids', async () => {
    const app = buildApp();
    expect((await app.inject({ method: 'POST', url: '/v1/review', payload: { id: 'x' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/v1/review', payload: { id: 'rev-nope', action: 'expected' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/v1/simulate', payload: { service: 'x' } })).statusCode).toBe(400);
    expect((await app.inject('/v1/compare')).statusCode).toBe(400);
  });
});
