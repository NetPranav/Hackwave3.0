import type { CodeMap, Compare, DriftEvent, Fingerprint, SimulateRequest, SimulateResult } from '@seismo/contracts';
import { buildBaselines, type EndpointBaseline, type FieldBaseline } from './baseline.js';
import type { Finding } from './detectors/index.js';
import { score, usagesFor } from './severity.js';
import { suggestionFor } from './ai/templates.js';

/**
 * Compare & Simulate (P6.10). Compare builds SYNTHETIC examples from statistics (format classes, magnitudes,
 * allow-listed enum labels): no real response value is stored, so none can be shown. Simulate answers
 * "what if the provider changed X?" against the code map with the same severity rules as real drift.
 */

const dominant = (r: Record<string, number>) => Object.entries(r).sort((a, b) => b[1] - a[1])[0]?.[0];

function example(f: FieldBaseline): unknown {
  const t = dominant(f.types);
  if (t === 'null') return null;
  if (t === 'boolean') return true;
  if (t === 'integer' || t === 'number') { const m = Number(dominant(f.mag) ?? 0); return t === 'integer' ? 10 ** m : Number((1.5 * 10 ** m).toFixed(2)); }
  if (t === 'string') {
    const label = dominant(f.enumValues);
    if (label) return label;
    switch (dominant(f.fmt)) {
      case 'email': return 'user@example.com';
      case 'uuid': return '00000000-0000-4000-8000-000000000000';
      case 'prefixed_id': return 'id_123';
      case 'iso_date': return '2026-01-01T00:00:00Z';
      case 'url': return 'https://example.com/…';
      case 'phone': return '+910000000000';
      case 'currency_code': return 'XXX';
      case 'enum_candidate': return '<enum>';
      default: return `<text, ~${Math.round(f.lenP50 ?? 8)} chars>`;
    }
  }
  return null;
}

/** Field paths -> nested synthetic object. `data[].id` becomes { data: [{ id }] }. */
export function synthesize(b: EndpointBaseline | undefined): unknown {
  if (!b) return null;
  const root: Record<string, unknown> = {};
  const leaves = Object.entries(b.fields).filter(([p]) => !Object.keys(b.fields).some((q) => q !== p && (q.startsWith(`${p}.`) || q.startsWith(`${p}[]`))));
  for (const [path, f] of leaves) {
    const parts = path.split('.');
    let cur: Record<string, unknown> = root;
    parts.forEach((raw, i) => {
      const isArr = raw.endsWith('[]');
      const key = isArr ? raw.slice(0, -2) : raw;
      const last = i === parts.length - 1;
      if (last && !isArr) { cur[key] = example(f); return; }
      if (isArr) {
        const arr = (Array.isArray(cur[key]) ? cur[key] : (cur[key] = [{}])) as unknown[];
        if (last) { arr[0] = example(f); return; }
        if (typeof arr[0] !== 'object' || arr[0] === null) arr[0] = {};
        cur = arr[0] as Record<string, unknown>;
      } else {
        cur = (typeof cur[key] === 'object' && cur[key] !== null ? cur[key] : (cur[key] = {})) as Record<string, unknown>;
      }
    });
  }
  return root;
}

export function compare(fps: Fingerprint[], service: string, endpoint: string, windowMs = 60_000, now = Date.now()): Compare {
  const [method, ...rest] = endpoint.split(' ');
  const path = rest.join(' ');
  const mine = fps.filter((f) => f.service === service && f.method === method && f.endpoint === path && f.statusClass === '2xx');
  const cut = now - windowMs;
  const recent = mine.filter((f) => Date.parse(f.windowStart) + f.windowSeconds * 1000 >= cut);
  const older = mine.filter((f) => Date.parse(f.windowStart) + f.windowSeconds * 1000 < cut);
  const b = buildBaselines(older.length ? older : mine, now)[0];
  const w = buildBaselines(recent.length ? recent : mine, now)[0];
  const diff: Compare['diff'] = [];
  if (b && w) {
    for (const [p, f] of Object.entries(w.fields)) {
      const o = Object.hasOwn(b.fields, p) ? b.fields[p] : undefined;
      if (!o) { diff.push({ path: p, change: 'added', after: dominant(f.types) }); continue; }
      if (dominant(o.types) !== dominant(f.types)) diff.push({ path: p, change: 'type', before: dominant(o.types), after: dominant(f.types) });
      else if (Object.keys(o.mag).length && dominant(o.mag) !== dominant(f.mag)) diff.push({ path: p, change: 'magnitude', before: `10^${dominant(o.mag)}`, after: `10^${dominant(f.mag)}` });
      const newLabels = Object.keys(f.enumValues).filter((k) => !(k in o.enumValues));
      if (Object.keys(o.enumValues).length && newLabels.length) diff.push({ path: p, change: 'enum', before: Object.keys(o.enumValues), after: newLabels });
      if (o.arrayLenMax !== undefined && f.arrayLenMax !== undefined && f.arrayLenMax < o.arrayLenMax) diff.push({ path: p, change: 'length', before: o.arrayLenMax, after: f.arrayLenMax });
    }
    for (const p of Object.keys(b.fields)) if (!Object.hasOwn(w.fields, p) && b.fields[p]!.presence >= 0.95) diff.push({ path: p, change: 'removed', before: dominant(b.fields[p]!.types) });
  }
  return { service, endpoint, v1: synthesize(b), v2: synthesize(recent.length && older.length ? w : undefined), diff };
}

const DETECTOR: Record<SimulateRequest['scenario']['kind'], { detector: string; rung: 'alias' | 'review'; title: (s: SimulateRequest['scenario']) => string }> = {
  rename: { detector: 'D3', rung: 'alias', title: (s) => `Field renamed: ${s.field} → ${(s as { to: string }).to}` },
  remove: { detector: 'D1', rung: 'review', title: (s) => `Field removed: ${s.field}` },
  type: { detector: 'D4', rung: 'review', title: (s) => `Type changed: ${s.field} → ${(s as { to: string }).to}` },
  units: { detector: 'D5', rung: 'review', title: (s) => `Unit change: ${s.field} ×${(s as { factor: number }).factor}` },
  enum: { detector: 'D7', rung: 'review', title: (s) => `New ${s.field} value: ${(s as { value: string }).value}` },
  limit: { detector: 'D9', rung: 'review', title: (s) => `Lists now capped at ${(s as { max: number }).max}` },
};

export function simulate(req: SimulateRequest, maps: CodeMap[]): SimulateResult {
  const d = DETECTOR[req.scenario.kind];
  const [method, ...rest] = req.endpoint.split(' ');
  const finding: Finding = { detector: d.detector, service: req.service, method: method!, endpoint: rest.join(' '), field: req.scenario.field, confidence: 0.9, title: d.title(req.scenario), evidence: {}, rung: d.rung, exposure: 1 };
  const usages = usagesFor(finding, maps);
  const s = score(finding, usages);
  // Fix ladder: only a rename is alias-eligible (still subject to checks C1-C6); a type change is a transform; the rest is behaviour.
  const rung: SimulateResult['fixRung'] = req.scenario.kind === 'rename' ? 'alias' : req.scenario.kind === 'type' ? 'transform' : 'behaviour';
  const workflows = [...new Set(maps.flatMap((m) => m.workflows.filter((w) => usages.some((u) => w.globs.some((g) => globToRegex(g).test(u.file)))).map((w) => w.name)))];
  const pseudo: DriftEvent = { id: 'sim', service: req.service, endpoint: req.endpoint, field: req.scenario.field, detector: d.detector, title: finding.title, severity: s.label, state: 'suspected', confidence: 0.9, detectedAt: new Date().toISOString(), before: null, after: req.scenario.kind === 'limit' ? { maxLength: (req.scenario as { max: number }).max } : null, usages: usages.map((u) => ({ file: u.file, line: u.line, kind: u.money ? `${u.kind}+money` : u.kind })) };
  return {
    detector: d.detector, severity: s.label, fixRung: rung, workflows,
    affected: pseudo.usages,
    explanation: `${finding.title}: ${usages.length ? `${usages.length} code location(s) read it` : 'no code reads it'}; severity ${s.label}. ${rung === 'alias' ? 'Seismo would open an alias PR (if checks C1–C6 pass).' : 'Seismo would open a review item, never an automatic fix.'} ${suggestionFor(pseudo)}`,
  };
}

function globToRegex(g: string) {
  const re = g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '@@').replace(/\*/g, '[^/]*').replace(/@@/g, '.*');
  return new RegExp('^' + re + '$');
}
