import { distance } from 'fastest-levenshtein';
import type { EndpointBaseline, FieldBaseline } from '../baseline.js';

export interface Finding {
  detector: string;                 // D1..D17
  service: string; method: string; endpoint: string;
  field?: string;
  confidence: number;               // 0..1
  title: string;
  evidence: { before?: unknown; after?: unknown };
  rung: 'alias' | 'review';
  rename?: { from: string; to: string; margin: number; valueSimilarity: number };
  /** Share of the window affected (exposure). */
  exposure: number;
}

export interface Ctx { minSamples: number }
export const DEFAULT_CTX: Ctx = { minSamples: 20 };
type Detector = (base: EndpointBaseline, win: EndpointBaseline, ctx: Ctx) => Finding[];

const where = (b: EndpointBaseline) => ({ service: b.service, method: b.method, endpoint: b.endpoint });
const dominant = (r: Record<string, number>) => Object.entries(r).sort((a, b) => b[1] - a[1])[0]?.[0];
const share = (r: Record<string, number>, k?: string) => { const t = Object.values(r).reduce((a, b) => a + b, 0); return t && k ? (r[k] ?? 0) / t : 0; };
const parentOf = (p: string) => p.slice(0, Math.max(p.lastIndexOf('.'), 0));
const leafOf = (p: string) => p.slice(p.lastIndexOf('.') + 1);
// Only leaf fields matter for presence changes; container paths are noisy.
const winPresence = (win: EndpointBaseline, path: string) => win.fields[path]?.presence ?? 0;

/** D1: a field that was nearly always there is (nearly) gone. */
export const d1Missing: Detector = (base, win, ctx) => {
  if (base.statusClass !== '2xx' || win.samples < ctx.minSamples) return [];
  return Object.entries(base.fields).filter(([p, f]) => f.presence >= 0.95 && winPresence(win, p) <= 0.05 && !isContainer(base, p)).map(([p, f]) => ({
    ...where(base), detector: 'D1', field: p, confidence: 0.9, title: `Field removed: ${p}`, rung: 'review' as const,
    evidence: { before: { presence: round(f.presence) }, after: { presence: round(winPresence(win, p)) } }, exposure: 1 - winPresence(win, p),
  }));
};

/** D2: a field that was never there now shows up in most responses. */
export const d2New: Detector = (base, win, ctx) => {
  if (base.statusClass !== '2xx' || win.samples < ctx.minSamples) return [];
  return Object.entries(win.fields).filter(([p, f]) => !base.fields[p] && f.presence >= 0.5 && !isContainer(win, p)).map(([p, f]) => ({
    ...where(base), detector: 'D2', field: p, confidence: 0.8, title: `New field: ${p}`, rung: 'review' as const,
    evidence: { before: { presence: 0 }, after: { presence: round(f.presence) } }, exposure: 0,
  }));
};

const isContainer = (b: EndpointBaseline, path: string) => Object.keys(b.fields).some((p) => p.startsWith(`${path}.`) || p.startsWith(`${path}[]`));
const round = (x: number) => Math.round(x * 100) / 100;

const tokens = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().split(/[_\W]+/).filter(Boolean);
export function nameSimilarity(a: string, b: string): number {
  const lev = 1 - distance(a.toLowerCase(), b.toLowerCase()) / Math.max(a.length, b.length, 1);
  const ta = new Set(tokens(a)), tb = new Set(tokens(b));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const jac = inter / (ta.size + tb.size - inter || 1);
  const contain = inter > 0 && (inter === ta.size || inter === tb.size) ? 0.8 : 0;
  return Math.max(lev, jac, contain);
}

export function valueSimilarity(a: FieldBaseline, b: FieldBaseline): number {
  const ka = Object.keys(a.hashes), kb = Object.keys(b.hashes);
  if (ka.length && kb.length) return ka.filter((k) => kb.includes(k)).length / new Set([...ka, ...kb]).size;
  const ea = Object.keys(a.enumValues), eb = Object.keys(b.enumValues);
  if (ea.length && eb.length) return ea.filter((k) => eb.includes(k)).length / new Set([...ea, ...eb]).size;
  if (a.lenP50 !== undefined && b.lenP50 !== undefined) return 1 - Math.abs(a.lenP50 - b.lenP50) / Math.max(a.lenP50, b.lenP50, 1);
  const ma = Object.keys(a.mag), mb = Object.keys(b.mag);
  if (ma.length && mb.length) return ma.filter((k) => mb.includes(k)).length / new Set([...ma, ...mb]).size;
  return 0.5;
}

/** D3: one field vanished and one appeared under the same parent; score by type, format, value and name similarity. */
export const d3Rename: Detector = (base, win, ctx) => {
  const gone = d1Missing(base, win, ctx), added = d2New(base, win, ctx);
  const out: Finding[] = [];
  const used = new Set<string>();
  for (const g of gone) {
    const scored: { f: Finding; score: number; vs: number }[] = [];
    for (const a of added) {
      if (used.has(a.field!) || parentOf(a.field!) !== parentOf(g.field!)) continue;
      const bf = base.fields[g.field!]!, wf = win.fields[a.field!]!;
      const type = dominant(bf.types) === dominant(wf.types) ? 1 : 0;
      const fmt = dominant(bf.fmt) === dominant(wf.fmt) ? 1 : 0;
      const vs = valueSimilarity(bf, wf);
      scored.push({ f: a, vs, score: 0.3 * type + 0.2 * fmt + 0.35 * vs + 0.15 * nameSimilarity(leafOf(g.field!), leafOf(a.field!)) });
    }
    scored.sort((x, y) => y.score - x.score);
    const best = scored[0];
    if (best && best.score >= 0.75) {
      used.add(best.f.field!);
      const margin = best.score - (scored[1]?.score ?? 0);
      out.push({
        ...where(base), detector: 'D3', field: g.field!, confidence: round(best.score), title: `Field renamed: ${g.field} → ${best.f.field}`,
        rung: 'alias', rename: { from: g.field!, to: best.f.field!, margin: round(margin), valueSimilarity: round(best.vs) }, exposure: 1,
        evidence: { before: { field: g.field, presence: round(base.fields[g.field!]!.presence) }, after: { field: best.f.field, presence: round(win.fields[best.f.field!]!.presence) } },
      });
    }
  }
  return out;
};

/** D4: the dominant type of a field changed in at least 80% of the window. */
export const d4Type: Detector = (base, win, ctx) => {
  if (base.statusClass !== '2xx' || win.samples < ctx.minSamples) return [];
  const out: Finding[] = [];
  for (const [p, wf] of Object.entries(win.fields)) {
    const bf = base.fields[p];
    if (!bf) continue;
    const bt = dominant(bf.types), wt = dominant(wf.types);
    if (!bt || !wt || bt === wt || ['null', 'object', 'array'].includes(bt)) continue;
    const numeric = new Set(['integer', 'number']);
    if (numeric.has(bt) && numeric.has(wt)) continue;
    if (share(wf.types, wt) >= 0.8) out.push({ ...where(base), detector: 'D4', field: p, confidence: 0.9, title: `Type changed: ${p} ${bt} → ${wt}`, rung: 'review', evidence: { before: { type: bt }, after: { type: wt } }, exposure: share(wf.types, wt) });
  }
  return out;
};

/** D11: an error body with a shape never seen before on this endpoint. */
export const d11ErrorShape: Detector = (base, win, ctx) => {
  if (base.statusClass === '2xx' || base.statusClass === '3xx' || win.samples < Math.min(ctx.minSamples, 3) || base.shapes.length === 0) return [];
  const fresh = win.shapes.filter((s) => !base.shapes.includes(s));
  if (!fresh.length) return [];
  const fields = Object.keys(win.fields).slice(0, 6);
  return [{ ...where(base), detector: 'D11', confidence: 0.85, title: `Error response shape changed (${base.statusClass})`, rung: 'review', evidence: { before: { fields: Object.keys(base.fields).slice(0, 6) }, after: { fields } }, exposure: 1 }];
};

/** D12: rate-limit header changed, or 429s are suddenly common. */
export const d12RateLimit: Detector = (base, win) => {
  const out: Finding[] = [];
  const b = base.headers.rateLimitLimit, w = win.headers.rateLimitLimit;
  if (b && w && b !== w) out.push({ ...where(base), detector: 'D12', confidence: 0.9, title: `Rate limit changed: ${b} → ${w}`, rung: 'review', evidence: { before: { limit: b }, after: { limit: w } }, exposure: 1 });
  const r = (x: EndpointBaseline) => (x.statusCounts['429'] ?? 0) / Math.max(x.samples, 1);
  if (r(win) > Math.max(0.03, 3 * r(base))) out.push({ ...where(base), detector: 'D12', confidence: 0.8, title: 'Rate limiting (429) much more frequent', rung: 'review', evidence: { before: { rate429: round(r(base)) }, after: { rate429: round(r(win)) } }, exposure: r(win) });
  return out;
};

/** D13: Sunset / Deprecation headers appeared. */
export const d13Deprecation: Detector = (base, win) => {
  const out: Finding[] = [];
  if (win.headers.sunset && !base.headers.sunset) out.push({ ...where(base), detector: 'D13', confidence: 0.95, title: `Sunset announced: ${win.headers.sunset}`, rung: 'review', evidence: { before: null, after: { sunset: win.headers.sunset } }, exposure: 0.5 });
  if (win.headers.deprecation && !base.headers.deprecation) out.push({ ...where(base), detector: 'D13', confidence: 0.95, title: 'Endpoint marked deprecated', rung: 'review', evidence: { before: null, after: { deprecation: win.headers.deprecation } }, exposure: 0.5 });
  return out;
};

/** D14: success responses whose lists are suddenly empty. */
export const d14EmptySuccess: Detector = (base, win, ctx) => {
  if (base.statusClass !== '2xx' || win.samples < ctx.minSamples) return [];
  const arrays = Object.entries(base.fields).filter(([, f]) => f.arrayLenMax && f.arrayLenMax > 0 && dominant(f.types) === 'array');
  return arrays.filter(([p]) => (win.fields[p]?.arrayLenMax ?? 0) === 0 && win.fields[p]).map(([p]) => ({
    ...where(base), detector: 'D14', field: p, confidence: 0.8, title: `Success responses now return empty ${p}`, rung: 'review' as const,
    evidence: { before: { maxLen: base.fields[p]!.arrayLenMax }, after: { maxLen: 0 } }, exposure: 1,
  }));
};

/** D16: old and new field both present but their values differ (hashes), so the old one may go stale. */
export const d16DualField: Detector = (base, win, ctx) => {
  if (win.samples < ctx.minSamples) return [];
  const out: Finding[] = [];
  for (const [p, bf] of Object.entries(base.fields)) {
    const wf = win.fields[p];
    if (!wf || winPresence(win, p) < 0.5) continue;
    for (const [q, qf] of Object.entries(win.fields)) {
      if (q === p || base.fields[q] || parentOf(p) !== parentOf(q) || nameSimilarity(leafOf(p), leafOf(q)) < 0.6) continue;
      const hp = Object.keys(wf.hashes), hq = Object.keys(qf.hashes);
      if (hp.length && hq.length && hp.every((h) => !hq.includes(h)) && bf.presence >= 0.95)
        out.push({ ...where(base), detector: 'D16', field: p, confidence: 0.7, title: `Both ${p} and ${q} present but values differ`, rung: 'review', evidence: { before: { field: p }, after: { field: q } }, exposure: 0.5 });
    }
  }
  return out;
};

/** D17: a healthy endpoint now mostly returns 404/410. */
export const d17Gone: Detector = (base, win, ctx) => {
  if (win.samples < Math.min(ctx.minSamples, 5)) return [];
  const gone = (x: EndpointBaseline) => ((x.statusCounts['404'] ?? 0) + (x.statusCounts['410'] ?? 0)) / Math.max(x.samples, 1);
  return gone(win) > 0.2 && gone(base) < 0.05 ? [{ ...where(base), detector: 'D17', confidence: 0.9, title: 'Endpoint appears to be gone (404/410)', rung: 'review', evidence: { before: { gone: round(gone(base)) }, after: { gone: round(gone(win)) } }, exposure: gone(win) }] : [];
};

/**
 * Detectors on one endpoint + status class. D3 replaces the D1+D2 pair it explains.
 * D12's 429 share and D17 need all status classes together: see runStatusMixDetectors.
 */
export function runDetectors(base: EndpointBaseline, win: EndpointBaseline, ctx: Ctx = DEFAULT_CTX): Finding[] {
  const renames = d3Rename(base, win, ctx);
  const renamed = new Set(renames.flatMap((r) => [r.rename!.from, r.rename!.to]));
  const rest = [d1Missing, d2New, d4Type, d11ErrorShape, d13Deprecation, d14EmptySuccess, d16DualField]
    .flatMap((d) => d(base, win, ctx))
    .filter((f) => !(f.field && renamed.has(f.field) && (f.detector === 'D1' || f.detector === 'D2')));
  return [...renames, ...rest];
}

/** D12 (rate-limit header / 429 share) and D17 (404/410 share) on all-class profiles of one endpoint. */
export function runStatusMixDetectors(base: EndpointBaseline, win: EndpointBaseline, ctx: Ctx = DEFAULT_CTX): Finding[] {
  return [...d12RateLimit(base, win, ctx), ...d17Gone(base, win, ctx)];
}
