import type { AliasRule, CodeMap } from '@seismo/contracts';
import { safeName } from '@seismo/sdk/runtime';
import type { EndpointBaseline } from './baseline.js';
import type { Finding } from './detectors/index.js';

export interface CheckResult { id: 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'C8'; passed: boolean; detail: string }
export interface Plan {
  ok: boolean;
  rule?: AliasRule;
  checks: CheckResult[];
  /** Why this is a review item instead of an automatic PR. */
  reason?: string;
}

const dominant = (r: Record<string, number>) => Object.entries(r).sort((a, b) => b[1] - a[1])[0]?.[0];
const norm = (e: string) => e.replace(/\{[^}]+\}/g, '{id}');
const leaf = (p: string) => p.slice(p.lastIndexOf('.') + 1);
const parent = (p: string) => p.slice(0, Math.max(p.lastIndexOf('.'), 0));

/** `data[].user.name` -> `$.data[*].user`; `name` -> `$` (the rule's parent path). */
export function pathFor(field: string): string {
  const p = parent(field);
  return p ? '$.' + p.replace(/\[\]/g, '[*]') : '$';
}

export interface PlanInput {
  finding: Finding;
  base: EndpointBaseline;
  win: EndpointBaseline;
  maps: CodeMap[];
  existingRules: AliasRule[];
  eventId: string;
  today?: string;
}

/**
 * Alias planner (P5.4): only a rename may become an automatic PR, and only when conflict checks C1-C6 all pass.
 * C7 (property tests in the customer's CI) and C8 (their CI green) are filled in later by the PR bot.
 */
export function planAlias(i: PlanInput): Plan {
  const f = i.finding;
  if (f.detector !== 'D3' || !f.rename) return { ok: false, checks: [], reason: 'Only renames get automatic PRs; this goes to the review queue.' };
  const from = f.rename.from, to = f.rename.to;           // from = old name the app reads, to = new name the provider sends
  const target = leaf(from), source = leaf(to);
  const own = <T>(o: Record<string, T>, k: string): T | undefined => (Object.hasOwn(o, k) ? o[k] : undefined);
  const bf = own(i.base.fields, from), wf = own(i.win.fields, to);
  const checks: CheckResult[] = [];
  const add = (id: CheckResult['id'], passed: boolean, detail: string) => checks.push({ id, passed, detail });

  add('C1', safeName(target) && safeName(source) && target !== source, `names "${target}" and "${source}" are identifier-safe`);

  const stillThere = own(i.win.fields, from)?.presence ?? 0;
  add('C2', stillThere <= 0.01, `"${target}" is present in ${Math.round(stillThere * 100)}% of recent responses (must be ≤ 1%)`);

  const sameType = !!bf && !!wf && dominant(bf.types) === dominant(wf.types) && dominant(bf.fmt) === dominant(wf.fmt);
  add('C3', sameType, sameType ? `both are ${dominant(wf!.types)} / ${dominant(wf!.fmt)}` : 'type or format class differs between the old and the new field');

  add('C4', f.rename.valueSimilarity >= 0.5, `value similarity ${f.rename.valueSimilarity} (must be ≥ 0.5)`);

  const reads = i.maps.flatMap((m) => {
    const ids = new Set(m.callSites.filter((c) => c.service === f.service && c.method === f.method && norm(c.endpoint) === norm(f.endpoint)).map((c) => c.id));
    return m.fieldReads.filter((r) => ids.has(r.callSiteId) && (r.field === to || r.field === source));
  });
  const endpointKey = `${f.method} ${f.endpoint}`;
  const path = pathFor(from);
  const clash = i.existingRules.find((r) => norm(r.endpoint) === norm(endpointKey) && r.path === path && (r.target === target || r.source === source));
  add('C5', reads.length === 0 && !clash, clash ? `rule ${clash.id ?? ''} already targets this key` : reads.length ? `code already reads "${source}" (${reads[0]!.file}:${reads[0]!.line})` : 'no code reads the new name and no rule targets this key');

  add('C6', f.rename.margin >= 0.15, `best candidate leads the runner-up by ${f.rename.margin} (must be ≥ 0.15)`);

  const failed = checks.filter((c) => !c.passed);
  if (failed.length) return { ok: false, checks, reason: `Blocked by ${failed.map((c) => c.id).join(', ')}: ${failed[0]!.detail}` };
  return {
    ok: true, checks,
    rule: { id: `a-${i.eventId.slice(-6)}`, kind: 'alias', endpoint: endpointKey, path, target, source, driftEvent: i.eventId, addedAt: i.today ?? new Date().toISOString().slice(0, 10) },
  };
}
