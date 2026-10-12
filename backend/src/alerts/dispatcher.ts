import { randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';
import type { AiExplanation, Channel, DriftEvent, Notification, NotificationSettings, Severity } from '@seismo/contracts';

/**
 * Alert dispatcher (P6.7 + P4.6). One alert per drift event per channel; the GitHub issue is updated on every state
 * change (opened -> fix pending -> resolved). Per-channel severity thresholds; WhatsApp defaults to breaking only.
 * Every send is fail-safe: a failing channel is logged, never blocks the others or the engine.
 */
export interface GithubIssueSink {
  upsertIssue(i: { repo: string; eventId: string; title: string; body: string; severity: Severity; state: string }): Promise<{ url: string }>;
}

export interface DispatcherOptions {
  settings: () => Promise<NotificationSettings>;
  fetchImpl?: typeof fetch;
  twilio?: { accountSid?: string; authToken?: string; from?: string; contentSid?: string; contentVariables?: string; baseUrl?: string };
  resend?: { apiKey?: string; from?: string; baseUrl?: string };
  github?: GithubIssueSink;
  dashboardUrl?: string;
  onNotification?: (n: Notification) => void;          // SSE fan-out for the bell
}

const RANK: Record<Severity, number> = { info: 0, warning: 1, breaking: 2 };

export class Dispatcher {
  readonly log: Notification[] = [];
  private sent = new Set<string>();
  private f: typeof fetch;
  constructor(private o: DispatcherOptions) {
    this.f = o.fetchImpl ?? ((...a) => fetch(...a));
    this.o.twilio = { accountSid: process.env.TWILIO_ACCOUNT_SID, authToken: process.env.TWILIO_AUTH_TOKEN, from: process.env.TWILIO_WHATSAPP_FROM, contentSid: process.env.TWILIO_WHATSAPP_CONTENT_SID || undefined, contentVariables: process.env.TWILIO_WHATSAPP_CONTENT_VARIABLES || undefined, baseUrl: 'https://api.twilio.com', ...o.twilio };
    this.o.resend = { apiKey: process.env.RESEND_API_KEY, from: process.env.RESEND_FROM ?? 'Seismo <onboarding@resend.dev>', baseUrl: 'https://api.resend.com', ...o.resend };
  }

  private passes(channel: Channel, sev: Severity, s: NotificationSettings) {
    const own = (s as unknown as Record<string, { minSeverity?: Severity }>)[channel]?.minSeverity;
    const min = own ?? (channel === 'whatsapp' ? 'breaking' : s.minSeverity);
    return RANK[sev] >= RANK[min];
  }

  /** Send everything this event should trigger. Returns the notifications recorded in this call. */
  async dispatch(e: DriftEvent, x: AiExplanation, repo?: string): Promise<Notification[]> {
    if (!['breaking', 'suspected', 'fix_pending', 'resolved'].includes(e.state)) return [];
    const s = await this.o.settings();
    const out: Notification[] = [];
    const link = this.o.dashboardUrl ? `${this.o.dashboardUrl}/app/drift/${e.id}` : '';
    const once = async (channel: Channel, key: string, send: () => Promise<void>) => {
      if (this.sent.has(key)) return;
      this.sent.add(key);
      const n: Notification = { id: `ntf-${randomBytes(5).toString('hex')}`, driftId: e.id, channel, title: x.title, sentAt: new Date().toISOString(), ok: true, read: false };
      try { await send(); } catch (err) { n.ok = false; n.error = String((err as Error).message ?? err).slice(0, 300); this.sent.delete(key); }
      this.log.unshift(n);
      if (this.log.length > 500) this.log.length = 500;
      out.push(n);
      try { this.o.onNotification?.(n); } catch { /* never let a listener break dispatch */ }
    };

    // Resolution: only the GitHub issue is updated; other channels already said what they had to say.
    const opening = e.state !== 'resolved';
    if (opening) await once('dashboard', `${e.id}|dashboard`, async () => undefined);

    if (opening && s.whatsapp.enabled && s.whatsapp.to && this.passes('whatsapp', e.severity, s)) {
      // twice at most: when the change is found (link: the repo), and when its fix PR opens (link: the PR to merge)
      const prUrl = e.fix?.validation?.prUrl;
      const msg = whatsappMessage(e, x, { repo, prUrl, dashboard: link });
      const key = prUrl ? `${e.id}|whatsapp|pr` : `${e.id}|whatsapp`;
      await once('whatsapp', key, () => this.whatsapp(s.whatsapp.to!, msg.text, msg.vars));
    }
    if (opening && s.slack.enabled && s.slack.webhookUrl && this.passes('slack', e.severity, s)) {
      await once('slack', `${e.id}|slack`, () => this.post(s.slack.webhookUrl!, { text: x.channels.slack + (link ? `\n<${link}|Open in Seismo>` : '') }));
    }
    if (opening && s.discord.enabled && s.discord.webhookUrl && this.passes('discord', e.severity, s)) {
      await once('discord', `${e.id}|discord`, () => this.post(s.discord.webhookUrl!, { content: x.channels.slack.replace(/\*/g, '**').slice(0, 1900) + (link ? `\n${link}` : '') }));
    }
    if (opening && s.email.enabled && s.email.to && this.passes('email', e.severity, s)) {
      await once('email', `${e.id}|email`, () => this.email(s.email.to!, x.channels.emailSubject, x.channels.emailBody + (link ? `\n\n${link}` : '')));
    }
    if (s.github.enabled && repo && this.o.github && (this.passes('github', e.severity, s) || this.sent.has(`${e.id}|github|breaking`) || this.sent.has(`${e.id}|github|suspected`) || this.sent.has(`${e.id}|github|fix_pending`))) {
      // one issue per event, updated (same issue) on each state change
      await once('github', `${e.id}|github|${e.state}`, async () => {
        await this.o.github!.upsertIssue({ repo, eventId: e.id, title: `[Seismo] ${x.title}`, severity: e.severity, state: e.state, body: issueBody(e, x, link) });
      });
    }
    return out;
  }

  /** Demo reset: forget what was sent. */
  clear() { this.log.length = 0; this.sent.clear(); }

  /** "Send test" button (P6.13). */
  async test(): Promise<Notification[]> {
    const fake: DriftEvent = { id: `test-${Date.now()}`, service: 'seismo', endpoint: 'TEST', detector: 'D0', title: 'Test notification from Seismo', severity: 'breaking', state: 'breaking', confidence: 1, detectedAt: new Date().toISOString(), before: null, after: null, usages: [] };
    const x = { title: 'Test notification from Seismo', summary: 'If you can read this, alerts work.', impact: 'none', recommendation: 'none', risk: 'low' as const, channels: { whatsapp: 'Seismo test: alerts are working.', slack: '*Seismo test*: alerts are working.', emailSubject: 'Seismo test notification', emailBody: 'If you can read this, Seismo email alerts work.' }, confidence: 1, model: 'template', latencyMs: 0, source: 'template' as const };
    return this.dispatch(fake, x);
  }

  private async whatsapp(to: string, body: string, vars: Record<string, string> = { change: body, link: '' }) {
    const t = this.o.twilio!;
    if (!t.accountSid || !t.authToken || !t.from) throw new Error('Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM)');
    const toAddr = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const r = await this.f(`${t.baseUrl}/2010-04-01/Accounts/${t.accountSid}/Messages.json`, {
      method: 'POST', signal: AbortSignal.timeout(15_000),
      headers: { authorization: `Basic ${Buffer.from(`${t.accountSid}:${t.authToken}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
      // Trial Twilio accounts may only send Twilio's pre-approved templates (no free text): with
      // TWILIO_WHATSAPP_CONTENT_SID set, every alert sends that template instead of the text (a ping to open Seismo).
      body: new URLSearchParams(t.contentSid ? { From: t.from, To: toAddr, ContentSid: t.contentSid, ...contentVariables(t.contentVariables, vars) } : { From: t.from, To: toAddr, Body: body }).toString(),
    });
    if (!r.ok) {
      const text = (await r.text()).slice(0, 300);
      const code = Number(/"code":\s*(\d+)/.exec(text)?.[1]);
      // found live: every alert failed with 21654 on a trial account; say what to do instead of a raw error
      if (code === 21654 || code === 21655) throw new Error(`Twilio ${code}: this Twilio account can only send pre-approved WhatsApp templates (trial accounts cannot send free text). Upgrade the Twilio account (then the WhatsApp Sandbox sends full alerts), or set TWILIO_WHATSAPP_CONTENT_SID to a template from Console -> Messaging -> Try it out -> Send a WhatsApp message.`);
      throw new Error(`Twilio ${r.status}: ${text.slice(0, 200)}`);
    }
  }

  private async email(to: string, subject: string, text: string) {
    // SMTP first (e.g. Gmail with an app password: free, sends to any address), else Resend
    if (process.env.SMTP_HOST) {
      const port = Number(process.env.SMTP_PORT ?? 465);
      const tx = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, connectionTimeout: 15_000, socketTimeout: 15_000 });
      await tx.sendMail({ from: process.env.SMTP_FROM ?? `Seismo <${process.env.SMTP_USER}>`, to, subject, text });
      return;
    }
    const rs = this.o.resend!;
    if (!rs.apiKey) throw new Error('Email is not configured: set SMTP_HOST/SMTP_USER/SMTP_PASS (e.g. Gmail app password) or RESEND_API_KEY');
    const r = await this.f(`${rs.baseUrl}/emails`, {
      method: 'POST', signal: AbortSignal.timeout(15_000),
      headers: { authorization: `Bearer ${rs.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: rs.from, to: [to], subject, text }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }

  private async post(url: string, body: unknown) {
    if (!/^https:\/\//.test(url) && !/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error('webhook URL must be https');
    const r = await this.f(url, { method: 'POST', signal: AbortSignal.timeout(15_000), headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`webhook ${r.status}`);
  }
}

export function issueBody(e: DriftEvent, x: AiExplanation, link: string) {
  return [
    `<!-- seismo:${e.id} -->`,
    `**${x.title}** · severity **${e.severity}** · state **${e.state}** · detector ${e.detector} · confidence ${Math.round(e.confidence * 100)}%`,
    '', x.summary, '', `**Impact:** ${x.impact}`, '', `**What to do:** ${x.recommendation}`,
    '', '**Where it is used**', ...(e.usages.length ? e.usages.slice(0, 10).map((u) => `- \`${u.file}:${u.line}\` (${u.kind})`) : ['- no reads found']),
    ...(e.fix?.validation?.prUrl ? ['', `**Fix PR:** ${e.fix.validation.prUrl}`] : []),
    ...(link ? ['', `[Open in Seismo](${link})`] : []),
    '', `_Explanation: ${x.source === 'ai' ? `AI (${x.model}, ${x.latencyMs} ms)` : 'template'}. Seismo never changes code; humans decide._`,
  ].join('\n');
}

/**
 * The WhatsApp alert: what changed, in which API, and the one link to act on (the fix PR once it exists, else the
 * repository). Short on purpose: a phone notification, not a report.
 */
export function whatsappMessage(e: DriftEvent, x: AiExplanation, o: { repo?: string; prUrl?: string; dashboard?: string }) {
  const repoUrl = o.repo && o.repo.includes('/') ? `https://github.com/${o.repo}` : undefined;
  const sev = e.severity === 'breaking' ? 'breaking' : e.severity === 'warning' ? 'needs a look' : 'info';
  const change = `API change in ${e.service} (${sev}): ${e.title}`;
  const link = o.prUrl ?? repoUrl ?? o.dashboard ?? '';
  const text = o.prUrl
    ? `Seismo: fix ready for the ${e.service} API change "${e.title}". Review and merge: ${o.prUrl}`
    : `Seismo: ${change}. ${x.channels.whatsapp}${link ? ` ${repoUrl ? 'Repo' : 'Details'}: ${link}` : ''}`;
  return { text: text.slice(0, 1500), vars: { change: change.slice(0, 300), link, service: e.service, title: e.title, severity: sev, pr: o.prUrl ?? '', repo: repoUrl ?? '' } };
}

/**
 * Template variables from TWILIO_WHATSAPP_CONTENT_VARIABLES, e.g. {"1":"{change}","2":"{link}"}: placeholders
 * {change} {link} {service} {title} {severity} {pr} {repo}. Without it the template is sent as it is.
 */
export function contentVariables(spec: string | undefined, vars: Record<string, string>): { ContentVariables?: string } {
  if (!spec) return {};
  try {
    const map = JSON.parse(spec) as Record<string, string>;
    const filled = Object.fromEntries(Object.entries(map).map(([k, v]) => [k, String(v).replace(/\{(\w+)\}/g, (_, n: string) => vars[n] ?? '')]));
    return { ContentVariables: JSON.stringify(filled) };
  } catch { return {}; }
}
