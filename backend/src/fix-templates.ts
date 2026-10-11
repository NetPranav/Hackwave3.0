import type { DriftEvent, SeismoRule } from '@seismo/contracts';
import { applyAliases, applyTransforms, type AliasRule } from '@seismo/sdk/runtime';
import { pathFor } from './planner.js';

/**
 * v2 fix templates: for each kind of change a FIXED, tested data rule (never AI-written code), and a stress test that
 * must pass before a PR is opened. The AI may only suggest which known value a new enum value means (the judge);
 * the rule itself, its checks and the decision to open a PR are deterministic.
 *
 *   rename (D3)            -> alias  (automatic PR, unchanged)
 *   unit change (D5)       -> scale  (divide by the factor)            needs review
 *   type change (D4)       -> coerce (lossless back to the old type)   needs review
 *   new enum value (D7)    -> map    (new value -> closest known)      needs review, only with the judge's choice
 *   limit / pagination / error format / removal -> no data rule fixes these: code change, review only
 */
export interface Template { rule?: SeismoRule; why: string }

const leaf = (p: string) => p.slice(p.lastIndexOf('.') + 1);
const ev = (x: unknown) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {});
const today = () => new Date().toISOString().slice(0, 10);

export function factorFromTitle(title: string): number {
  const m = /×(1\/)?([\d.]+)/.exec(title);
  return m ? (m[1] ? 1 / Number(m[2]) : Number(m[2])) : NaN;
}

/** "In-Transit", "in transit", "IN_TRANSIT" are one value spelled differently; "lost" and "in_transit" are not. */
export function sameValueSpelling(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return norm(a) === norm(b) && norm(a).length > 0;
}

export function templateFor(e: DriftEvent): Template {
  if (!e.field) return { why: 'This change has no single field to fix: it needs a code change.' };
  const base = { id: `f-${e.id.slice(-6)}`, endpoint: e.endpoint, path: pathFor(e.field), field: leaf(e.field), driftEvent: e.id, addedAt: today() };
  const before = ev(e.before), after = ev(e.after);
  switch (e.detector) {
    case 'D5': {
      const f = factorFromTitle(e.title);
      if (!Number.isFinite(f) || f <= 0 || f === 1) return { why: 'The unit factor is not known for this change.' };
      return { rule: { ...base, id: `s-${e.id.slice(-6)}`, kind: 'scale', divideBy: f }, why: `Divide ${base.field} by ${f} (unit change).` };
    }
    case 'D4': {
      const from = String(before['type'] ?? ''), to = String(after['type'] ?? '');
      const numeric = (t: string) => t === 'integer' || t === 'number';
      if (numeric(from) && to === 'string') return { rule: { ...base, kind: 'coerce', to: 'number' }, why: `Convert ${base.field} back to a number when the text is a plain number.` };
      if (from === 'string' && numeric(to)) return { rule: { ...base, kind: 'coerce', to: 'string' }, why: `Convert ${base.field} back to text.` };
      return { why: `No lossless conversion from ${to} back to ${from}: the code has to change.` };
    }
    case 'D7': {
      const known = Array.isArray(before['values']) ? (before['values'] as unknown[]).map(String) : [];
      const added = Array.isArray(after['added']) ? (after['added'] as { value?: unknown }[]).map((a) => String(a.value)) : [];
      const j = e.explanation?.judgement;
      if (!added.length) return { why: 'The new value is not known.' };
      if (!j || j.confidence < 0.5 || !known.includes(j.choice)) return { why: `Which known ${base.field} does "${added[0]}" mean? The AI judge has no confident answer, so a person has to decide (add a case in the code).` };
      // Only a spelling/format variant of a known value may be mapped (In-Transit -> in_transit). A value with a new
      // MEANING must never be folded into an old one, however sure the AI is (found by the pipeline run: the judge
      // proposed "lost" -> "in_transit", which would show a lost parcel as on its way).
      if (!sameValueSpelling(added[0]!, j.choice)) return { why: `"${added[0]}" is a new ${base.field} with its own meaning (the AI judge guessed "${j.choice}", but mapping a new meaning onto an old value would hide it). Add a case for it in the code.` };
      return { rule: { ...base, kind: 'map', map: { [added[0]!]: j.choice } }, why: `Treat "${added[0]}" as "${j.choice}" (AI judge, ${Math.round(j.confidence * 100)}% sure: ${j.reason}). Please confirm.` };
    }
    default:
      return { why: 'No data rule can fix this kind of change: it needs a code change.' };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Stress test (C9): the rule, together with every rule already in the repo, on thousands of generated responses.

export interface StressResult { passed: boolean; runs: number; failures: string[] }

const NUMERIC = /^-?(0|[1-9][0-9]{0,14})(\.[0-9]{1,10})?$/;

function expectedValue(rule: SeismoRule, v: unknown): unknown {
  const r = rule as { kind: string; divideBy?: number; to?: string; map?: Record<string, unknown> };
  if (r.kind === 'scale') return typeof v === 'number' && Number.isFinite(v) ? v / r.divideBy! : v;
  if (r.kind === 'coerce') return r.to === 'number' ? (typeof v === 'string' && NUMERIC.test(v) ? Number(v) : v) : (typeof v === 'number' && Number.isFinite(v) ? String(v) : v);
  if (r.kind === 'map') return typeof v === 'string' && Object.prototype.hasOwnProperty.call(r.map ?? {}, v) ? r.map![v] : v;
  return v;
}

const deepFreeze = <T>(o: T): T => { if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };

/** Deterministic pseudo-random generator, so a failing run can be reproduced from its seed. */
function rng(seed: number) { let s = seed; return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); }

export function stressTest(rule: SeismoRule, existing: SeismoRule[] = [], runs = 2000, seed = 7): StressResult {
  const rnd = rng(seed);
  const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]!;
  const failures: string[] = [];
  const all = [...existing, rule];
  const aliases = all.filter((r) => !r.kind || r.kind === 'alias') as AliasRule[];
  const pipeline = (body: unknown) => applyTransforms(applyAliases(body, aliases, rule.endpoint), all, rule.endpoint);
  const isAlias = !rule.kind || rule.kind === 'alias';
  const field = isAlias ? (rule as AliasRule).target : (rule as { field: string }).field;
  const mapKeys = Object.keys((rule as { map?: Record<string, unknown> }).map ?? {});
  const samples: unknown[] = [0, -7, 499, 49900, 1.5, Number.MAX_SAFE_INTEGER, '499', '12.50', '-3', '', ' 12', '1e3', '0x10', '12abc', 'NaN', null, true, false, [], {}, ...mapKeys, 'other_value'];
  const nested = (rule.path ?? '$') !== '$';

  for (let i = 0; i < runs && failures.length < 5; i++) {
    const v = rnd() < 0.5 ? pick(samples) : rnd() < 0.5 ? Math.round(rnd() * 1e6) : String(Math.round(rnd() * 1e6));
    const extra = { keep: `k${i}`, nestedObj: { a: i, b: [1, 2] } };
    const record: Record<string, unknown> = isAlias
      ? (rnd() < 0.5 ? { [(rule as AliasRule).source]: v, ...extra } : { [(rule as AliasRule).target]: 'old', [(rule as AliasRule).source]: v, ...extra })
      : { [field]: v, ...extra };
    const input = deepFreeze(nested ? { data: [record, { ...record, keep: 'second' }] } : record);
    let out: unknown;
    try { out = pipeline(input); } catch (e) { failures.push(`threw on ${JSON.stringify(input)}: ${(e as Error).message}`); continue; }
    const recs = (nested ? (out as { data: Record<string, unknown>[] }).data : [out]) as Record<string, unknown>[];
    const ins = (nested ? (input as { data: Record<string, unknown>[] }).data : [input]) as Record<string, unknown>[];
    recs.forEach((o, k) => {
      const inRec = ins[k]!;
      for (const key of Object.keys(inRec)) if (key !== field && JSON.stringify(o[key]) !== JSON.stringify(inRec[key])) failures.push(`changed "${key}" on ${JSON.stringify(inRec)}`);
      if (isAlias) {
        const want = Object.prototype.hasOwnProperty.call(inRec, field) ? inRec[field] : inRec[(rule as AliasRule).source];
        if (JSON.stringify(o[field]) !== JSON.stringify(want)) failures.push(`alias gave ${JSON.stringify(o[field])} for ${JSON.stringify(inRec)}`);
      } else if (JSON.stringify(o[field]) !== JSON.stringify(expectedValue(rule, inRec[field]))) {
        failures.push(`${rule.kind} gave ${JSON.stringify(o[field])} for ${JSON.stringify(inRec[field])}`);
      }
    });
    if (!all.some((r) => r.kind === 'scale')) {   // a scale rule divides on every pass by design
      let twice: unknown;
      try { twice = pipeline(deepFreeze(structuredClone(out))); } catch { twice = undefined; }
      if (JSON.stringify(twice) !== JSON.stringify(out)) failures.push(`not idempotent on ${JSON.stringify(input)}`);
    }
  }
  // the old shape must still pass through untouched (same object) when no rule applies to it
  if (!isAlias) {
    const untouched = deepFreeze({ unrelated: 1 });
    if (pipeline(untouched) !== untouched) failures.push('a response without the field was copied or changed');
  }
  return { passed: failures.length === 0, runs, failures };
}

export const stressCheck = (s: StressResult) => ({
  id: 'C9' as const, passed: s.passed,
  detail: s.passed ? `stress test: ${s.runs} generated responses (edge cases, nested, frozen input): never throws, only the named field changes, exactly as the rule says${'' }, idempotent where it must be`
    : `stress test failed: ${s.failures.slice(0, 2).join('; ')}`,
});
