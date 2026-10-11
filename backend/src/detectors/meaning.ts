import type { EndpointBaseline, FieldBaseline } from '../baseline.js';
import type { Ctx, Finding } from './index.js';

/**
 * P6 semantic + behavioural detectors. All deterministic: they compare statistics, never values, and never call the AI.
 * D5 unit change · D6 value drift · D7 new enum value · D8 enum value vanished · D9 silent truncation · D10 pagination change
 */

const where = (b: EndpointBaseline) => ({ service: b.service, method: b.method, endpoint: b.endpoint });
const round = (x: number) => Math.round(x * 100) / 100;
const total = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
const share = (r: Record<string, number>) => { const t = total(r); return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, t ? v / t : 0])); };
const own = <T>(o: Record<string, T>, k: string) => (Object.hasOwn(o, k) ? o[k] : undefined);
const numeric = (f: FieldBaseline) => (f.types['integer'] ?? 0) + (f.types['number'] ?? 0) > 0.8 * total(f.types);

/** Overlap of two distributions after shifting `b`'s keys by k (sum of min shares). */
function shiftedOverlap(a: Record<string, number>, b: Record<string, number>, k: number) {
  const sa = share(a), sb = share(b);
  let o = 0;
  for (const [m, v] of Object.entries(sa)) o += Math.min(v, sb[String(Number(m) + k)] ?? 0);
  return o;
}

const NON_DECIMAL: [number, string][] = [[60, 'seconds ↔ minutes'], [1000, 'ms ↔ s / g ↔ kg'], [4.45, 'lbf ↔ N'], [1.609, 'miles ↔ km'], [2.205, 'kg ↔ lb']];

/** D5: every value moved by the same factor (×10^k, or a known non-decimal factor). */
export const d5Unit = (base: EndpointBaseline, win: EndpointBaseline, ctx: Ctx): Finding[] => {
  if (base.statusClass !== '2xx' || win.samples < ctx.minSamples) return [];
  const out: Finding[] = [];
  for (const [path, wf] of Object.entries(win.fields)) {
    const bf = own(base.fields, path);
    if (!bf || !numeric(bf) || !numeric(wf) || !Object.keys(bf.mag).length || !Object.keys(wf.mag).length) continue;
    const same = shiftedOverlap(bf.mag, wf.mag, 0);
    let best = { k: 0, o: same };
    for (const k of [-3, -2, -1, 1, 2, 3]) { const o = shiftedOverlap(bf.mag, wf.mag, k); if (o > best.o) best = { k, o }; }
    const ratio = bf.numP50 && wf.numP50 ? wf.numP50 / bf.numP50 : undefined;
    if (best.k !== 0 && best.o >= 0.8 && same <= 0.2) {
      // percentiles, when both sides have them, must agree with the magnitude shift (within 20 %)
      if (ratio !== undefined && Math.abs(Math.log10(ratio) - best.k) > Math.log10(1.2)) continue;
      const factor = 10 ** best.k;
      out.push({
        ...where(base), detector: 'D5', field: path, confidence: round(0.6 + 0.4 * best.o), rung: 'review', exposure: best.o,
        title: `Unit change: ${path} ×${factor >= 1 ? factor : `1/${1 / factor}`}`,
        evidence: { before: { magnitudes: bf.mag, p50: bf.numP50 }, after: { magnitudes: wf.mag, p50: wf.numP50, factor } },
      });
      continue;
    }
    if (ratio !== undefined && best.k === 0) {
      for (const [f, label] of NON_DECIMAL) {
        for (const r of [f, 1 / f]) {
          if (Math.abs(ratio / r - 1) < 0.05) {
            out.push({ ...where(base), detector: 'D5', field: path, confidence: 0.75, rung: 'review', exposure: 1, title: `Unit change: ${path} ×${round(r)} (${label}?)`, evidence: { before: { p50: bf.numP50 }, after: { p50: wf.numP50 } } });
          }
        }
      }
    }
  }
  return out;
};

/** D6: the distribution moved, but not by a clean unit factor. Review only. */
export const d6ValueDrift = (base: EndpointBaseline, win: EndpointBaseline, ctx: Ctx, explained: Set<string>): Finding[] => {
  if (base.statusClass !== '2xx' || win.samples < ctx.minSamples) return [];
  const out: Finding[] = [];
  for (const [path, wf] of Object.entries(win.fields)) {
    const bf = own(base.fields, path);
    if (!bf || explained.has(path) || !numeric(bf) || !numeric(wf)) continue;
    const tvd = 1 - shiftedOverlap(bf.mag, wf.mag, 0);           // total variation distance of magnitude histograms
    const p50Shift = bf.numP50 && wf.numP50 ? Math.abs(wf.numP50 / bf.numP50 - 1) : 0;
    if (tvd > 0.5 || p50Shift > 0.5) {
      out.push({ ...where(base), detector: 'D6', field: path, confidence: round(Math.min(0.9, 0.5 + Math.max(tvd, Math.min(p50Shift, 1)) / 2)), rung: 'review', exposure: Math.max(tvd, 0.5), title: `Value distribution changed: ${path}`, evidence: { before: { magnitudes: bf.mag, p50: bf.numP50 }, after: { magnitudes: wf.mag, p50: wf.numP50 } } });
    }
  }
  return out;
};

/** Labels for allow-listed fields, salted hashes otherwise (labels never leave the customer unless allow-listed). */
const enumKeys = (f: FieldBaseline) => (Object.keys(f.enumValues).length ? { kind: 'label' as const, counts: f.enumValues } : { kind: 'hash' as const, counts: f.hashes });

/** D7 new enum value + D8 vanished value (reported together when they happen on the same field). */
export const d7d8Enum = (base: EndpointBaseline, win: EndpointBaseline, ctx: Ctx): Finding[] => {
  if (base.statusClass !== '2xx' || win.samples < ctx.minSamples) return [];
  const out: Finding[] = [];
  for (const [path, wf] of Object.entries(win.fields)) {
    const bf = own(base.fields, path);
    if (!bf) continue;
    const b = enumKeys(bf), w = enumKeys(wf);
    const bTotal = total(b.counts), wTotal = total(w.counts);
    const distinct = Object.keys(b.counts).length;
    if (b.kind !== w.kind || distinct === 0 || distinct > 20 || bTotal < ctx.minEnumSamples || wTotal === 0) continue;
    const added = Object.entries(w.counts).filter(([k, n]) => !(k in b.counts) && n / wTotal >= 0.01);
    const vanished = Object.entries(b.counts).filter(([k, n]) => n / bTotal >= 0.05 && !(k in w.counts));
    const label = (k: string) => (b.kind === 'label' ? k : `value #${k.slice(0, 6)}`);
    if (added.length) {
      out.push({
        ...where(base), detector: 'D7', field: path, rung: 'review', confidence: round(Math.min(0.95, 0.7 + total(Object.fromEntries(added)) / wTotal)), exposure: total(Object.fromEntries(added)) / wTotal,
        title: `New ${path} value: ${added.map(([k]) => label(k)).join(', ')}`,
        evidence: { before: { values: b.kind === 'label' ? Object.keys(b.counts) : distinct }, after: { added: added.map(([k, n]) => ({ value: label(k), share: round(n / wTotal) })), vanished: vanished.map(([k]) => label(k)) } },
      });
    } else if (vanished.length && wTotal >= ctx.minEnumSamples) {
      out.push({ ...where(base), detector: 'D8', field: path, rung: 'review', confidence: 0.8, exposure: 0.5, title: `${path} value no longer seen: ${vanished.map(([k]) => label(k)).join(', ')}`, evidence: { before: { values: Object.keys(b.counts).map(label) }, after: { vanished: vanished.map(([k]) => label(k)) } } });
    }
  }
  return out;
};

/** D9: lists are suddenly cut at a lower maximum M, many responses are exactly M, and the app asked for more than M. */
export const d9Truncation = (base: EndpointBaseline, win: EndpointBaseline, ctx: Ctx): Finding[] => {
  if (base.statusClass !== '2xx' || win.samples < Math.min(ctx.minSamples, 5)) return [];
  const out: Finding[] = [];
  for (const [path, wf] of Object.entries(win.fields)) {
    const bf = own(base.fields, path);
    if (!bf || bf.arrayLenMax === undefined || wf.arrayLenMax === undefined) continue;
    const M = wf.arrayLenMax, B = bf.arrayLenMax, atM = wf.arrayAtMaxShare ?? 0;
    if (M === 0 || M >= B || atM < 0.3) continue;
    const asked = win.reqLimit;
    const confirmed = asked !== undefined && asked > M;
    out.push({
      ...where(base), detector: 'D9', field: path, rung: 'review', exposure: atM, confidence: confirmed ? 0.95 : 0.7,
      title: confirmed ? `Silent truncation: asked ${asked}, got exactly ${M} in ${Math.round(atM * 100)}% of calls` : `Lists now capped at ${M} (was up to ${B})`,
      evidence: { before: { maxLength: B, limitAsked: base.reqLimit }, after: { maxLength: M, shareAtMax: round(atM), limitAsked: asked } },
    });
  }
  return out;
};

const CURSOR = /(^|[._])(next_?cursor|cursor|next_?page_?token|page_?token|continuation(_token)?|starting_after|after)$/i;
const PAGE = /(^|[._])(page|page_?number|offset|total_?pages|total)$/i;

/** D10: pagination style changed (a cursor appeared / page fields vanished), or a "next page" repeats the first page's items. */
export const d10Pagination = (base: EndpointBaseline, win: EndpointBaseline, ctx: Ctx): Finding[] => {
  if (base.statusClass !== '2xx' || win.samples < Math.min(ctx.minSamples, 5)) return [];
  const cursorNew = Object.keys(win.fields).filter((p) => CURSOR.test(p) && !own(base.fields, p));
  const pageGone = Object.keys(base.fields).filter((p) => PAGE.test(p) && (own(base.fields, p)!.presence >= 0.95) && (own(win.fields, p)?.presence ?? 0) <= 0.05);
  const out: Finding[] = [];
  if (cursorNew.length || pageGone.length) {
    out.push({
      ...where(base), detector: 'D10', field: cursorNew[0] ?? pageGone[0], rung: 'review', exposure: 1, confidence: cursorNew.length && pageGone.length ? 0.95 : 0.75,
      title: cursorNew.length ? `Pagination changed to cursors (${cursorNew.join(', ')})${pageGone.length ? `; ${pageGone.join(', ')} gone` : ''}` : `Pagination fields gone: ${pageGone.join(', ')}`,
      evidence: { before: { pageFields: pageGone, queryKeys: base.reqQueryKeys }, after: { cursorFields: cursorNew, queryKeys: win.reqQueryKeys } },
    });
  }
  return out;
};

export function runMeaningDetectors(base: EndpointBaseline, win: EndpointBaseline, ctx: Ctx): Finding[] {
  const d5 = d5Unit(base, win, ctx);
  return [...d5, ...d6ValueDrift(base, win, ctx, new Set(d5.map((f) => f.field!))), ...d7d8Enum(base, win, ctx), ...d9Truncation(base, win, ctx), ...d10Pagination(base, win, ctx)];
}
