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
