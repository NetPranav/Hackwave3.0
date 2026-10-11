import { createHash } from 'node:crypto';
import type { AnnouncedChange, CodeMap, DriftEvent, RadarItem } from '@seismo/contracts';
import type { Finding } from '../detectors/index.js';
import { score, usagesFor } from '../severity.js';
import { suggestionFor } from '../ai/templates.js';
import type { NimClient } from '../ai/nim.js';
import { extractByAi, extractByRules } from './extract.js';

/** Where the radar looks, per provider (P7.1). `service` is the name used by the SDK and the scanner. */
export interface RadarSource { service: string; rss?: string; html?: string; openapi?: string }

/** The four fake providers (P1), served by Hackwave3.0/services. */
export function demoSources(base = process.env.SERVICES_URL ?? 'http://localhost:4100'): RadarSource[] {
  return [['users', 'users'], ['payments', 'payments'], ['shipping', 'shipping'], ['orders', 'orders']].map(([service, p]) => ({
    service: service!, rss: `${base}/${p}/changelog?format=rss`, openapi: `${base}/${p}/openapi.json`,
  }));
}

export interface FeedEntry { id: string; title: string; text: string; link?: string; date?: string }

const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const tag = (xml: string, name: string) => { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')); return m ? decode(m[1]!) : ''; };

/** RSS 2.0 and Atom, enough for changelog feeds (title + description/content + date + link). */
export function parseFeed(xml: string): FeedEntry[] {
  const blocks = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map((m) => m[2]!);
  return blocks.map((b) => {
    const title = tag(b, 'title');
    const text = tag(b, 'description') || tag(b, 'content') || tag(b, 'summary') || tag(b, 'content:encoded');
    const link = tag(b, 'link') || (b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '');
    const date = tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published');
    return { id: createHash('sha256').update(title + '\n' + text).digest('hex').slice(0, 16), title, text: `${title}. ${text}`, ...(link ? { link } : {}), ...(date ? { date } : {}) };
  });
}

/** Structural diff of two OpenAPI-ish documents: every changed leaf under `paths` becomes a change (P7.2, spec source). */
export function diffSpec(before: unknown, after: unknown): { path: string; before: unknown; after: unknown }[] {
  const out: { path: string; before: unknown; after: unknown }[] = [];
  const walk = (a: unknown, b: unknown, p: string) => {
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    const obj = (x: unknown) => x !== null && typeof x === 'object' && !Array.isArray(x);
    if (obj(a) && obj(b)) { for (const k of new Set([...Object.keys(a as object), ...Object.keys(b as object)])) walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], p ? `${p}.${k}` : k); return; }
    out.push({ path: p, before: a, after: b });
  };
  walk((before as { paths?: unknown })?.paths, (after as { paths?: unknown })?.paths, '');
  return out;
}

/** Spec diff -> announced changes (deterministic; the quote is the diff line itself, which is in the source by construction). */
export function changesFromSpec(diff: ReturnType<typeof diffSpec>): AnnouncedChange[] {
  return diff.map((d) => {
    const [path, , ...rest] = d.path.split('.');
    const key = rest.join('.') || d.path;
    const line = `${d.path}: ${JSON.stringify(d.before)} -> ${JSON.stringify(d.after)}`;
    const t: AnnouncedChange['changeType'] = /maxLimit|limit/i.test(key) ? 'limit' : /pagination/i.test(key) ? 'pagination' : /deprecated/i.test(key) ? 'deprecation' : /amount|unit/i.test(key) && /paise|cents/i.test(String(d.after)) ? 'units' : /fields/i.test(key) ? 'removal' : 'other';
    return { endpoint: path, changeType: t, summary: `Spec changed: ${key} ${JSON.stringify(d.before)} → ${JSON.stringify(d.after)}`.slice(0, 300), quote: line.slice(0, 500) };
  });
}

const DETECTOR: Record<AnnouncedChange['changeType'], string> = { rename: 'D3', removal: 'D1', type: 'D4', units: 'D5', limit: 'D9', pagination: 'D10', deprecation: 'D13', enum: 'D7', other: 'D0' };
const norm = (e: string) => e.replace(/\{[^}]+\}/g, '{id}').replace(/\/+$/, '');

/** Matcher (P7.4): announced change -> the code that will be affected, with the same severity rules as real drift. */
export function matchChange(c: AnnouncedChange, service: string, maps: CodeMap[]): { usages: ReturnType<typeof usagesFor>; endpoint?: string; severity: RadarItem['severity'] } {
  const sites = maps.flatMap((m) => m.callSites).filter((s) => !s.unresolved && s.service === service);
  const wanted = c.endpoint ? norm(c.endpoint.replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/, '')) : undefined;
  const method = c.endpoint?.match(/^(GET|POST|PUT|PATCH|DELETE)\s/)?.[1];
  const hit = sites.filter((s) => (!wanted || norm(s.endpoint) === wanted || norm(s.endpoint).startsWith(`${wanted}/`)) && (!method || s.method === method));
  const endpoints = [...new Set(hit.map((s) => `${s.method} ${norm(s.endpoint)}`))];
  const usages = endpoints.flatMap((ep) => {
    const [m, ...p] = ep.split(' ');
    const f: Finding = { detector: DETECTOR[c.changeType], service, method: m!, endpoint: p.join(' '), ...(c.field && c.changeType !== 'limit' && c.changeType !== 'pagination' && c.changeType !== 'deprecation' ? { field: c.field } : {}), confidence: 0.8, title: c.summary, evidence: {}, rung: 'review', exposure: 1 };
    return usagesFor(f, maps);
  });
  const f0: Finding = { detector: DETECTOR[c.changeType], service, method: 'GET', endpoint: '/', confidence: 0.8, title: c.summary, evidence: {}, rung: 'review', exposure: 1, ...(c.field ? { field: c.field } : {}) };
  // Announced, not yet happening: never "breaking" on the radar; at most a warning, info when no code is affected.
  const sev = usages.length ? (score(f0, usages).label === 'info' ? 'info' : 'warning') : 'info';
  return { usages, ...(endpoints[0] ? { endpoint: endpoints[0] } : {}), severity: sev };
}

export interface RadarOptions { sources: RadarSource[]; maps: () => Promise<CodeMap[]>; ai?: { client: NimClient; model: string; enabled: () => boolean }; fetchImpl?: typeof fetch; now?: () => Date }

/** Polls sources, keeps radar items, links them to drift events when traffic later shows the change. */
export class Radar {
  private items = new Map<string, RadarItem>();
  private seen = new Set<string>();
  private specs = new Map<string, unknown>();
  private f: typeof fetch;
  constructor(private o: RadarOptions) { this.f = o.fetchImpl ?? ((...a) => fetch(...a)); }

  list(events: DriftEvent[] = []): RadarItem[] {
    return [...this.items.values()].map((i) => {
      const ev = events.find((e) => e.service === i.service && e.detector === DETECTOR[i.changeType] && (!i.endpoint || norm(e.endpoint) === norm(i.endpoint)));
      return ev ? { ...i, driftEventId: ev.id } : i;
    }).sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  }

  /** One pass over every source. Returns the NEW radar items (for alerts). Source failures are skipped, never thrown. */
  async poll(): Promise<RadarItem[]> {
    const maps = await this.o.maps();
    const fresh: RadarItem[] = [];
    for (const src of this.o.sources) {
      if (src.rss) {
        try {
          const xml = await (await this.f(src.rss, { signal: AbortSignal.timeout(10_000) })).text();
          for (const e of parseFeed(xml)) {
            if (this.seen.has(`${src.service}|${e.id}`)) continue;
            this.seen.add(`${src.service}|${e.id}`);
            const { changes, by } = await this.extract(e.text);
            for (const c of changes) fresh.push(this.add(src.service, c, maps, { source: 'changelog (RSS)', ...(e.link ? { sourceUrl: e.link } : {}), extractedBy: by, title: e.title }));
          }
        } catch { /* a broken feed must not stop the others */ }
      }
      if (src.openapi) {
        try {
          const spec = await (await this.f(src.openapi, { signal: AbortSignal.timeout(10_000) })).json();
          const prev = this.specs.get(src.service);
          this.specs.set(src.service, spec);
          if (prev !== undefined) for (const c of changesFromSpec(diffSpec(prev, spec))) fresh.push(this.add(src.service, c, maps, { source: 'OpenAPI diff', sourceUrl: src.openapi, extractedBy: 'spec' }));
        } catch { /* skip */ }
      }
    }
    return fresh;
  }

  /** Sunset / Deprecation headers seen in traffic (D13 events) appear on the radar too. */
  fromHeaders(events: DriftEvent[]): RadarItem[] {
    const fresh: RadarItem[] = [];
    for (const e of events.filter((x) => x.detector === 'D13')) {
      const id = `rad-h-${e.id}`;
      if (this.items.has(id)) continue;
      const sunset = /^Sunset announced: (.*)$/.exec(e.title)?.[1];
      const d = sunset ? new Date(sunset) : undefined;
      const item: RadarItem = {
        id, service: e.service, title: e.title, kind: sunset ? 'sunset' : 'deprecation', changeType: 'deprecation', source: sunset ? 'Sunset header (RFC 8594)' : 'Deprecation header (RFC 9745)',
        ...(d && !Number.isNaN(d.getTime()) ? { date: d.toISOString().slice(0, 10) } : {}), endpoint: e.endpoint, matchedFiles: e.usages.map((u) => `${u.file}:${u.line}`),
        severity: e.usages.length ? 'warning' : 'info', suggestion: suggestionFor(e), extractedBy: 'header', driftEventId: e.id, detectedAt: e.detectedAt,
      };
      this.items.set(id, item);
      fresh.push(item);
    }
    return fresh;
  }

  private async extract(text: string): Promise<{ changes: AnnouncedChange[]; by: 'ai' | 'rules' }> {
    if (this.o.ai?.enabled() && this.o.ai.client.enabled) {
      try { const r = await extractByAi(this.o.ai.client, this.o.ai.model, text); if (r.changes.length) return { changes: r.changes, by: 'ai' }; } catch { /* fall back */ }
    }
    return { changes: extractByRules(text, this.o.now?.() ?? new Date()), by: 'rules' };
  }

  private add(service: string, c: AnnouncedChange, maps: CodeMap[], meta: { source: string; sourceUrl?: string; extractedBy: RadarItem['extractedBy']; title?: string }): RadarItem {
    const m = matchChange(c, service, maps);
    const id = `rad-${createHash('sha256').update(`${service}|${c.quote}|${c.changeType}`).digest('hex').slice(0, 12)}`;
    const limitN = c.changeType === 'limit' ? Number(c.summary.match(/\d+/)?.[0]) : undefined;
    const pseudo: DriftEvent = { id, service, endpoint: m.endpoint ?? c.endpoint ?? service, ...(c.field ? { field: c.field } : {}), detector: DETECTOR[c.changeType], title: c.summary, severity: m.severity, state: 'suspected', confidence: 0.8, detectedAt: new Date().toISOString(), before: null, after: limitN ? { maxLength: limitN } : null, usages: m.usages.map((u) => ({ file: u.file, line: u.line, kind: u.money ? `${u.kind}+money` : u.kind })) };
    const item: RadarItem = {
      id, service, title: meta.title && meta.title.length < 120 ? `${meta.title}: ${c.summary}`.slice(0, 200) : c.summary,
      kind: meta.extractedBy === 'spec' ? 'spec' : c.changeType === 'deprecation' ? 'deprecation' : 'changelog', changeType: c.changeType,
      ...(c.effectiveDate ? { date: c.effectiveDate } : {}), source: meta.source, ...(meta.sourceUrl ? { sourceUrl: meta.sourceUrl } : {}), quote: c.quote,
      ...(m.endpoint ? { endpoint: m.endpoint } : c.endpoint ? { endpoint: c.endpoint } : {}), ...(c.field ? { field: c.field } : {}),
      matchedFiles: [...new Set(m.usages.map((u) => `${u.file}:${u.line}`))], severity: m.severity, suggestion: suggestionFor(pseudo), extractedBy: meta.extractedBy,
      detectedAt: new Date().toISOString(),
    };
    this.items.set(id, item);
    return item;
  }
}
