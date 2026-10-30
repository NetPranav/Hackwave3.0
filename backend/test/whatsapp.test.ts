import { describe, expect, it } from 'vitest';
import { Dispatcher } from '../src/alerts/dispatcher.js';
import { DEFAULT_SETTINGS } from '../src/settings-store.js';

const settings = async () => ({ ...DEFAULT_SETTINGS, whatsapp: { enabled: true, to: '+919800000001', minSeverity: 'info' as const }, email: { enabled: false }, slack: { enabled: false }, discord: { enabled: false }, github: { enabled: false } });

function twilio(reply: (form: URLSearchParams) => Response) {
  const sent: URLSearchParams[] = [];
  const fetchImpl = (async (_url: string | URL, init?: RequestInit) => { const form = new URLSearchParams(String(init?.body)); sent.push(form); return reply(form); }) as typeof fetch;
  return { sent, fetchImpl };
}

describe('WhatsApp via Twilio (found live: every alert failed with 21654 on a trial account)', () => {
  it('a trial account (free text refused) gets a message that says what to do, not a raw error', async () => {
    const t = twilio(() => new Response('{"code":21654,"message":"ContentSid Required","status":400}', { status: 400 }));
    const d = new Dispatcher({ settings, fetchImpl: t.fetchImpl, twilio: { accountSid: 'AC1', authToken: 't', from: 'whatsapp:+17372508034', baseUrl: 'http://twilio' } });
    const n = (await d.test()).find((x) => x.channel === 'whatsapp');
    expect(n).toMatchObject({ channel: 'whatsapp', ok: false });
    expect(n!.error).toContain('can only send pre-approved WhatsApp templates');
    expect(n!.error).toContain('TWILIO_WHATSAPP_CONTENT_SID');
  });
  it('with TWILIO_WHATSAPP_CONTENT_SID the template is sent instead of the text', async () => {
    const t = twilio(() => new Response('{"sid":"SM1"}', { status: 201 }));
    const d = new Dispatcher({ settings, fetchImpl: t.fetchImpl, twilio: { accountSid: 'AC1', authToken: 't', from: 'whatsapp:+17372508034', contentSid: 'HXabc', baseUrl: 'http://twilio' } });
    const n = (await d.test()).find((x) => x.channel === 'whatsapp');
    expect(n).toMatchObject({ channel: 'whatsapp', ok: true });
    expect(t.sent[0]!.get('ContentSid')).toBe('HXabc');
    expect(t.sent[0]!.has('Body')).toBe(false);
    expect(t.sent[0]!.get('To')).toBe('whatsapp:+919800000001');
  });
});

describe('the WhatsApp alert says what changed and links to the repo, then to the fix PR', () => {
  const ev = { id: 'drift-1', service: 'users', endpoint: 'GET /users/{id}', field: 'name', detector: 'D3', title: 'Field renamed: name → full_name', severity: 'breaking' as const, state: 'breaking' as const, confidence: 0.9, detectedAt: '2026-10-12T00:00:00.000Z', before: null, after: null, usages: [] };
  const x = { title: 't', summary: 's', impact: 'i', recommendation: 'r', risk: 'high' as const, channels: { whatsapp: 'Your checkout reads name.', slack: 's', emailSubject: 'e', emailBody: 'b' }, confidence: 1, model: 'template', latencyMs: 0, source: 'template' as const };
  it('found: API change + repo link; PR opened: a second message with the PR link; template variables filled', async () => {
    const t = twilio(() => new Response('{"sid":"SM1"}', { status: 201 }));
    const d = new Dispatcher({ settings, fetchImpl: t.fetchImpl, twilio: { accountSid: 'AC1', authToken: 't', from: 'whatsapp:+1', contentSid: 'HXabc', contentVariables: '{"1":"{change}","2":"{link}"}', baseUrl: 'http://twilio' } });
    await d.dispatch(ev, x, 'acme/shop');
    await d.dispatch(ev, x, 'acme/shop');                                    // same state again: nothing new
    await d.dispatch({ ...ev, state: 'fix_pending', fix: { rung: 'alias', validation: { driftId: 'drift-1', checks: [], ci: 'pending', prUrl: 'https://github.com/acme/shop/pull/7' } } }, x, 'acme/shop');
    const vars = t.sent.map((f) => JSON.parse(f.get('ContentVariables')!));
    expect(vars).toEqual([
      { 1: 'API change in users (breaking): Field renamed: name → full_name', 2: 'https://github.com/acme/shop' },
      { 1: 'API change in users (breaking): Field renamed: name → full_name', 2: 'https://github.com/acme/shop/pull/7' },
    ]);
  });
  it('free text (paid account / sandbox): the same two messages as plain text', async () => {
    const t = twilio(() => new Response('{"sid":"SM1"}', { status: 201 }));
    const d = new Dispatcher({ settings, fetchImpl: t.fetchImpl, twilio: { accountSid: 'AC1', authToken: 't', from: 'whatsapp:+1', baseUrl: 'http://twilio' } });
    await d.dispatch(ev, x, 'acme/shop');
    await d.dispatch({ ...ev, state: 'fix_pending', fix: { rung: 'alias', validation: { driftId: 'drift-1', checks: [], ci: 'pending', prUrl: 'https://github.com/acme/shop/pull/7' } } }, x, 'acme/shop');
    expect(t.sent.map((f) => f.get('Body'))).toEqual([
      'Seismo: API change in users (breaking): Field renamed: name → full_name. Your checkout reads name. Repo: https://github.com/acme/shop',
      'Seismo: fix ready for the users API change "Field renamed: name → full_name". Review and merge: https://github.com/acme/shop/pull/7',
    ]);
  });
});
