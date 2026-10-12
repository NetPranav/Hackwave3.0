import { PROJECT_ID } from './projects.js';
import type { AliasRule, CodeMap, DriftEvent, DriftState, Fingerprint, SeismoRule } from '@seismo/contracts';
import { alignSalts, buildBaselines } from './baseline.js';
import { stressCheck, stressTest, templateFor } from './fix-templates.js';
import { DEFAULT_CTX, runDetectors, runStatusMixDetectors, type Ctx, type Finding } from './detectors/index.js';
import type { IngestStore } from './ingest-store.js';
import { memoryEvents, type EventStore, type StoredEvent } from './event-store.js';
import { pathFor, planAlias, type CheckResult } from './planner.js';
import { score, usagesFor } from './severity.js';

export interface EngineOptions {
  windowMs: number;          // recent window compared against the baseline
  baselineMs: number;        // history before the window
  minBaselineSamples: number;
  confirmRuns: number;       // consecutive runs a finding must persist before it is confirmed
  ctx?: Partial<Ctx>;        // detector thresholds (tests and demos use smaller sample sizes)
}
// SEISMO_BASELINE_HOURS: how much history a pass reads. Every pass re-reads it (until v3-P3.3 rollups), so a small host
// needs a short one (found on Render free: 24 h of per-request fingerprints starved the CPU and the health check failed)
export const ENGINE_DEFAULTS: EngineOptions = { windowMs: 60_000, baselineMs: Number(process.env.SEISMO_BASELINE_HOURS ?? 24) * 3600_000, minBaselineSamples: 50, confirmRuns: 2 };

type Tracked = Omit<StoredEvent, 'key'>;

const LATE_MS = 10 * 60_000;   // fingerprints delivered up to 10 min late still reach the in-memory history
const CLOSED: string[] = ['resolved', 'expected', 'snoozed'];

/** Passes (5 s apart) without a confirmed change before it counts as gone: the provider went back to normal. */
const RECOVER_RUNS = 3;

const OPEN_CONFIRMED = (t: Tracked, confirmRuns: number) => t.runs >= confirmRuns && ['breaking', 'suspected', 'fix_pending'].includes(t.event.state);

/** Opens fix PRs on the customer's repo (the GitHub App). Optional: without it, renames stay "breaking" with a suggested rule. */
export interface FixDispatcher {
  existingRules(repo: string): Promise<SeismoRule[]>;
  openPr(i: { repo: string; rule: SeismoRule; checks: CheckResult[]; usages: { file: string; line: number }[]; eventId: string }): Promise<{ url: string; number: number }>;
}

/** Runs the detectors over stored fingerprints and keeps drift events with their state machine (suspected -> confirmed). */
export class DriftEngine {
  private events = new Map<string, Tracked>();
  /** endpoint -> when the first finding of the current investigation was seen (baseline frozen from there) */
  private investigating = new Map<string, number>();
  /** learning progress per endpoint (2xx history samples) from the last pass: a change before `ready` is learned, not reported */
  private learned = new Map<string, { service: string; endpoint: string; samples: number }>();
  /** endpoint -> time ranges when a change was live and later reverted: kept out of the baseline (they were not normal) */
  private quarantine = new Map<string, [number, number][]>();
  private loaded?: Promise<void>;
  constructor(private ingest: IngestStore, private maps: () => Promise<CodeMap[]>, private opts: EngineOptions = ENGINE_DEFAULTS, private fixer?: FixDispatcher, private store: EventStore = memoryEvents()) {}

  /** Load remembered events (once). Call at startup so list() is complete before the first detection pass. */
  init(): Promise<void> {
    // everything a pass relies on is restored, also why an event was resolved and the periods kept out of the baseline
    // (found on Render free: each restart forgot them, the reverted test changes leaked into the baseline and a real
    // rename was never confirmed; a recurrence after a restart stayed "resolved")
    this.loaded ??= this.store.load().then((items) => {
      for (const { key, ...tracked } of items) {
        if (this.events.has(key)) continue;
        this.events.set(key, tracked);
        if (tracked.quarantine && tracked.resolvedBy === 'recovered') {
          const ep = `${tracked.event.service}|${tracked.event.endpoint}`;
          this.quarantine.set(ep, [...(this.quarantine.get(ep) ?? []), tracked.quarantine]);
        }
      }
    }).catch(() => undefined);
    return this.loaded;
  }

  private persist(keys: Iterable<string>) {
    const items: StoredEvent[] = [];
    for (const k of keys) { const t = this.events.get(k); if (t) items.push({ key: k, ...t }); }
    return this.store.save(items).catch(() => undefined);   // persistence is best effort; detection never stops for it
  }
  private keyOf(id: string) { for (const [k, t] of this.events) if (t.event.id === id) return k; return undefined; }

  /** Events that need a human: everything non-alias, and renames the planner blocked. */
  reviewQueue(): { event: DriftEvent; reason: string }[] {
    return [...this.events.values()].filter((t) => t.reviewReason && !['resolved', 'expected', 'snoozed'].includes(t.event.state)).map((t) => ({ event: t.event, reason: t.reviewReason! }));
  }

  /** Endpoints seen in the last minute and how far their baseline is (needs `minBaselineSamples` before changes count). */
  readiness() {
    const needed = this.opts.minBaselineSamples;
    return [...this.learned.values()].map((r) => ({ ...r, needed, ready: r.samples >= needed })).sort((a, b) => a.endpoint.localeCompare(b.endpoint));
  }

  list(): DriftEvent[] {
    return [...this.events.values()].map((t) => t.event).sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  }

  /** A fix PR was merged/closed (GitHub webhook): resolve the event whose rule id matches. */
  resolveByRule(ruleId: string, merged: boolean): DriftEvent | undefined {
    for (const t of this.events.values()) {
      if (t.event.fix?.rule?.id !== ruleId) continue;
      t.event = { ...t.event, state: merged ? 'resolved' : 'breaking' };
      if (merged) t.resolvedBy = 'fix';
      if (!merged) t.dispatched = false;
      void this.persist([this.keyOf(t.event.id)!]);
      return t.event;
    }
    return undefined;
  }

  /**
   * P5.10: a HUMAN asked for a suggestion PR on a unit change (D5). Proposes one `scale` rule (divide by the factor),
   * labelled needs-review, never merged by Seismo. Returns an error string when not applicable.
   */
  /**
   * v2: a human asked for the fix of a review item. The fix template gives the data rule; it is stress-tested together
   * with every rule already in the repo (C9) and the PR opens ONLY when the stress test passes.
   */
  async openTemplatePr(id: string, repo: string | undefined): Promise<{ event?: DriftEvent; error?: string }> {
    const k = this.keyOf(id);
    const t = k ? this.events.get(k) : undefined;
    if (!t) return { error: 'unknown_event' };
    const tpl = templateFor(t.event);
    if (!tpl.rule) return { error: tpl.why };
    if (!this.fixer || !repo) return { error: 'No GitHub App connection for this repo.' };
    const existing = await this.fixer.existingRules(repo).catch(() => []);
    const stress = stressTest(tpl.rule, existing);
    const checks = [stressCheck(stress)];
    if (!stress.passed) return { error: `Not opened: ${checks[0]!.detail}` };
    const rule = tpl.rule;
    const pr = await this.fixer.openPr({ repo, rule, checks, usages: t.event.usages.map((u) => ({ file: u.file, line: u.line })), eventId: t.event.id });
    t.event = { ...t.event, state: 'fix_pending', fix: { rung: 'transform', rule, validation: { driftId: t.event.id, checks, ci: 'pending', prUrl: pr.url } } };
    t.dispatched = true;
    await this.persist([k!]);
    return { event: t.event };
  }

  /**
   * The fingerprints of the baseline period, kept in memory: each pass fetches only rows newer than the last pass (with a
   * 10-minute overlap for late deliveries, e.g. the SDK retry queue after an outage, deduplicated) instead of re-reading and re-parsing the whole history (found on
   * Render free: re-reading starved the CPU).
   */
  private cache: Fingerprint[] = [];
  private cacheKeys = new Set<string>();
  private cachedUntil = 0;
  private async history(now: number): Promise<Fingerprint[]> {
    const floor = now - this.opts.baselineMs;
    const from = this.cachedUntil ? Math.max(floor, this.cachedUntil - LATE_MS) : floor;
    for (const f of await this.ingest.since(PROJECT_ID(), from)) {
      const k = f.batchId ?? `${f.service}|${f.method}|${f.endpoint}|${f.statusClass}|${f.windowStart}|${f.count}|${f.shapeHash}|${f.saltId ?? ''}`;
      if (!this.cacheKeys.has(k)) { this.cacheKeys.add(k); this.cache.push(f); }
    }
    this.cachedUntil = now;
    if (this.cache.some((f) => Date.parse(f.windowStart) <= floor)) {
      this.cache = this.cache.filter((f) => Date.parse(f.windowStart) > floor);
      this.cacheKeys = new Set(this.cache.map((f) => f.batchId ?? `${f.service}|${f.method}|${f.endpoint}|${f.statusClass}|${f.windowStart}|${f.count}|${f.shapeHash}|${f.saltId ?? ''}`));
    }
    return this.cache;
  }

  /**
   * Recent fingerprints for the API (status, charts, compare) from the same in-memory history the detector uses, so a
   * dashboard poll does not re-read and re-parse thousands of rows (found on Render free: the 7-day chart read every
   * row on each poll and the engine missed its health check). Covers the baseline period (what is kept anyway).
   */
  async recent(sinceMs: number, now = Date.now()): Promise<Fingerprint[]> {
    const all = this.cachedUntil && now - this.cachedUntil < 30_000 ? this.cache : await this.history(now);
    return all.filter((f) => Date.parse(f.windowStart) + f.windowSeconds * 1000 >= sinceMs);
  }

  /** Demo reset (P8.5): forget every event, in memory and in the store. */
  async clear(): Promise<void> {
    await this.init();
    this.cache = []; this.cacheKeys.clear(); this.cachedUntil = 0;
    const ids = [...this.events.values()].map((t) => t.event.id);
    this.events.clear();
    this.investigating.clear();
    this.learned.clear();
    this.quarantine.clear();
    await this.store.remove(ids).catch(() => undefined);
  }

  /** P5.6: the customer's CI finished on the fix PR -> C7 + C8 and the CI state on the event. */
  recordCi(ruleId: string, conclusion: string, by = 'CI'): DriftEvent | undefined {
    for (const [k, t] of this.events) {
      const v = t.event.fix?.validation;
      if (t.event.fix?.rule?.id !== ruleId || !v) continue;
      const green = conclusion === 'success';
      const others = v.checks.filter((c) => c.id !== 'C7' && c.id !== 'C8');
      t.event = { ...t.event, fix: { ...t.event.fix!, validation: { ...v, ci: green ? 'green' : 'red', checks: [...others,
        { id: 'C7', passed: green, detail: `alias property tests ran in ${by}: ${conclusion}` },
        { id: 'C8', passed: green, detail: `${by} on the fix PR: ${conclusion}` }] } } };
      void this.persist([k]);
      return t.event;
    }
    return undefined;
  }

  /** Attach data produced outside detection (AI explanation). */
  attach(id: string, patch: Partial<DriftEvent>) {
    for (const [k, t] of this.events) if (t.event.id === id) { t.event = { ...t.event, ...patch }; void this.persist([k]); }
  }

  /** Repo whose code uses this service (for issues and PRs). */
  get(id: string) { for (const t of this.events.values()) if (t.event.id === id) return t.event; return undefined; }

  setState(id: string, state: DriftState) {
    for (const [k, t] of this.events) if (t.event.id === id) { t.event = { ...t.event, state }; void this.persist([k]); }
  }

  /** One detection pass. Returns the events that were created or changed in this pass. */
  async run(now = Date.now()): Promise<DriftEvent[]> {
    await this.init();
    const all = await this.history(now);
    const cut = now - this.opts.windowMs;
    // Baseline freeze: while a confirmed change is open on an endpoint, traffic from after it started (detection time minus
    // one window) never becomes "history" for that endpoint. Otherwise a restart, or simply time passing, would teach the
    // baseline the broken shape and the change would stop being reported.
    const frozen = new Map<string, number>();
    // ...and from the FIRST finding of the current investigation on an endpoint while any finding there is still open:
    // a rename shows up as "new field" one pass before "field removed"/"renamed" can be scored, and the later findings
    // replace the earlier one. Anchoring on the later finding would let the new shape into the baseline and the rename
    // would never be confirmed.
    const openEp = new Set([...this.events.values()].filter((t) => !CLOSED.includes(t.event.state)).map((t) => `${t.event.service}|${t.event.endpoint}`));
    for (const [ep, since] of this.investigating) {
      if (!openEp.has(ep)) { this.investigating.delete(ep); continue; }
      frozen.set(ep, Math.min(frozen.get(ep) ?? Infinity, since - this.opts.windowMs));
    }
    for (const t of this.events.values()) {
      if (!OPEN_CONFIRMED(t, this.opts.confirmRuns)) continue;
      const ep = `${t.event.service}|${t.event.endpoint}`;
      const from = Date.parse(t.event.detectedAt) - this.opts.windowMs;
      frozen.set(ep, Math.min(frozen.get(ep) ?? Infinity, from));
    }
    const historyOf = (f: (typeof all)[number]) => {
      const end = Date.parse(f.windowStart) + f.windowSeconds * 1000;
      if (end >= cut) return false;
      const q = this.quarantine.get(`${f.service}|${f.method} ${f.endpoint}`);
      return !q?.some(([from, until]) => end >= from && Date.parse(f.windowStart) <= until);
    };
    // A freeze needs something to freeze: if the endpoint had too little history when the change appeared (Seismo was
    // still learning), there is no "before" to compare with. Then the new shape simply becomes normal; otherwise the
    // endpoint would stay frozen on a baseline too small to ever judge anything.
    for (const [ep, since] of frozen) {
      const before = all.filter((f) => `${f.service}|${f.method} ${f.endpoint}` === ep && historyOf(f) && Date.parse(f.windowStart) < since && f.statusClass === '2xx');
      if (before.reduce((n, f) => n + f.count, 0) < this.opts.minBaselineSamples) { frozen.delete(ep); this.investigating.delete(ep); }
    }
    const baseFps = all.filter((f) => {
      if (!historyOf(f)) return false;
      const since = frozen.get(`${f.service}|${f.method} ${f.endpoint}`);
      return since === undefined || Date.parse(f.windowStart) < since;
    });
    const winFps = all.filter((f) => Date.parse(f.windowStart) + f.windowSeconds * 1000 >= cut);
    const bases = buildBaselines(baseFps, now), wins = buildBaselines(winFps, now);
    this.learned = new Map();
    for (const w of wins.filter((x) => x.statusClass === '2xx')) {
      const b = bases.find((x) => x.service === w.service && x.method === w.method && x.endpoint === w.endpoint && x.statusClass === '2xx');
      this.learned.set(`${w.service}|${w.method} ${w.endpoint}`, { service: w.service, endpoint: `${w.method} ${w.endpoint}`, samples: b?.samples ?? 0 });
    }
    const maps = await this.maps();

    const findings: Finding[] = [];
    const ctxOf = new Map<Finding, { base: ReturnType<typeof buildBaselines>[number]; win: ReturnType<typeof buildBaselines>[number] }>();
    for (const w0 of wins) {
      const b0 = bases.find((x) => x.service === w0.service && x.method === w0.method && x.endpoint === w0.endpoint && x.statusClass === w0.statusClass);
      if (!b0 || b0.samples < this.opts.minBaselineSamples) continue;
      const [b, w] = alignSalts(b0, w0);
      for (const f of runDetectors(b, w, { ...DEFAULT_CTX, ...this.opts.ctx })) { findings.push(f); ctxOf.set(f, { base: b, win: w }); }
    }
    const basesAll = buildBaselines(baseFps, now, true);
    for (const w of buildBaselines(winFps, now, true)) {
      const b = basesAll.find((x) => x.service === w.service && x.method === w.method && x.endpoint === w.endpoint);
      if (b && b.samples >= this.opts.minBaselineSamples) for (const f of runStatusMixDetectors(b, w, { ...DEFAULT_CTX, ...this.opts.ctx })) { findings.push(f); ctxOf.set(f, { base: b, win: w }); }
    }

    const changed: DriftEvent[] = [];
    const seen = new Set<string>();
    for (const f of findings) { const ep = `${f.service}|${f.method} ${f.endpoint}`; if (!this.investigating.has(ep)) this.investigating.set(ep, now); }
    for (let f of findings) {
      const key = `${f.service}|${f.method}|${f.endpoint}|${f.detector}|${f.field ?? f.title}`;
      seen.add(key);
      const usages = usagesFor(f, maps);
      // A 'rename' whose NEW name is the field your code reads, while the old name is read nowhere, is the provider going
      // back to the shape your code expects (after Seismo had learned the changed shape, e.g. during learning or after a
      // reset). Proposing the reverse alias would add the throwaway name from the real field: report it, never fix it.
      const restored = f.detector === 'D3' && !!f.rename && !usages.length && usagesFor({ ...f, field: f.rename.to }, maps).length > 0;
      if (restored) f = { ...f, title: `Field restored: ${f.rename!.to} is back (it was ${f.rename!.from}); your code reads ${f.rename!.to}`, rung: 'review', rename: undefined };
      const s = score(f, usages);
      let prev = this.events.get(key);
      // the provider went back to normal earlier and now made the same change again: that is a new change, not the old one
      if (prev?.event.state === 'resolved' && prev.resolvedBy === 'recovered') { await this.store.remove([prev.event.id]).catch(() => undefined); this.events.delete(key); prev = undefined; }
      // ...and a DIFFERENT change to the same field (name -> fullName was fixed, now name -> customerName) is new too.
      // The same change after its fix stays resolved: the merged rule covers it. (Found recording the demo: the second
      // rename of "name" was filed under the first one's fixed event and never reported.)
      if (prev && ['resolved', 'expected'].includes(prev.event.state) && prev.event.title !== f.title) { await this.store.remove([prev.event.id]).catch(() => undefined); this.events.delete(key); prev = undefined; }
      const runs = (prev?.runs ?? 0) + 1;
      const confirmed = runs >= this.opts.confirmRuns;
      let state: DriftState = !confirmed ? (s.label === 'info' ? 'normal' : 'suspected') : s.label === 'breaking' ? 'breaking' : s.label === 'warning' ? 'suspected' : 'normal';
      if (prev && ['fix_pending', 'resolved', 'expected', 'snoozed'].includes(prev.event.state)) state = prev.event.state;
      const event: DriftEvent = {
        id: prev?.event.id ?? `drift-${Math.abs(hash(key + now)).toString(36)}`, service: f.service, endpoint: `${f.method} ${f.endpoint}`,
        ...(f.field ? { field: f.field } : {}), detector: f.detector, title: f.title, severity: s.label, state, confidence: f.confidence,
        detectedAt: prev?.event.detectedAt ?? new Date(now).toISOString(), before: f.evidence.before, after: f.evidence.after,
        usages: usages.map((u) => ({ file: u.file, line: u.line, kind: u.money ? `${u.kind}+money` : u.kind })),
        ...(prev?.event.explanation ? { explanation: prev.event.explanation } : {}),
        ...(f.rung === 'alias' && f.rename ? { fix: { rung: 'alias' as const, rule: { kind: 'alias' as const, endpoint: `${f.method} ${f.endpoint}`, path: pathFor(f.rename.from), source: f.rename.to.slice(f.rename.to.lastIndexOf('.') + 1), target: f.rename.from.slice(f.rename.from.lastIndexOf('.') + 1) } } } : {}),
      };
      let tracked: Tracked = { event, runs, lastSeen: now, dispatched: prev?.dispatched, reviewReason: prev?.reviewReason };
      const c = ctxOf.get(f);
      if (confirmed && s.label !== 'info' && c && !tracked.dispatched) {
        if (f.rung !== 'alias') tracked.reviewReason = 'Only renames get automatic PRs; this change needs a human decision.';
        else {
          const repo = maps.flatMap((m) => m.callSites).find((cs) => cs.service === f.service)?.repo;
          const plan = planAlias({ finding: f, base: c.base, win: c.win, maps, existingRules: repo && this.fixer ? ((await this.fixer.existingRules(repo).catch(() => [])).filter((r) => !r.kind || r.kind === 'alias') as AliasRule[]) : [], eventId: event.id });
          // C9: the alias rule, together with every rule already in the repo, on generated responses; no PR if it fails
          const stress = plan.ok ? stressCheck(stressTest(plan.rule!, repo && this.fixer ? await this.fixer.existingRules(repo).catch(() => []) : [])) : undefined;
          if (stress) plan.checks.push(stress);
          if (!plan.ok) tracked.reviewReason = plan.reason;
          else if (!stress!.passed) tracked.reviewReason = `Fix not opened: ${stress!.detail}`;
          else if (this.fixer && repo) {
            try {
              const pr = await this.fixer.openPr({ repo, rule: plan.rule!, checks: plan.checks, usages: usages.map((u) => ({ file: u.file, line: u.line })), eventId: event.id });
              tracked = { ...tracked, dispatched: true, event: { ...event, state: 'fix_pending', fix: { rung: 'alias', rule: plan.rule!, validation: { driftId: event.id, checks: plan.checks.map((k) => ({ id: k.id, passed: k.passed, detail: k.detail })), ci: 'pending', prUrl: pr.url } } } };
            } catch (e) { tracked.reviewReason = `PR could not be opened: ${(e as Error).message}`; }
          }
        }
      }
      // Once a human-facing state is set (PR open, resolved, expected, snoozed) the stored event is authoritative.
      if (prev && ['fix_pending', 'resolved', 'expected', 'snoozed'].includes(prev.event.state)) tracked = { ...tracked, event: prev.event };
      if (!prev || prev.event.state !== tracked.event.state || prev.event.severity !== tracked.event.severity) changed.push(tracked.event);
      this.events.set(key, tracked);
    }
    // A rename explains an earlier "field removed" on the same field (D1 often fires a pass before D3 can score the new
    // name): close the D1 event as explained, so the timeline and alerts tell one story.
    for (const f of findings) {
      if (f.detector !== 'D3' || !f.rename) continue;
      const k = `${f.service}|${f.method}|${f.endpoint}|D1|${f.field}`;
      const t = this.events.get(k);
      if (!t || seen.has(k) || ['resolved', 'expected', 'snoozed'].includes(t.event.state)) continue;
      t.event = { ...t.event, state: 'resolved', title: `${t.event.title} (explained: renamed to ${f.rename.to})` };
      seen.add(k);
      changed.push(t.event);
    }
    // Same for a unit change (D5): while the window is half old, half new, D6 "value distribution changed" fires first on
    // the same field (found by the pipeline run: two extra D6 events per unit change). D5 explains it.
    for (const f of findings) {
      if (f.detector !== 'D5' || !f.field) continue;
      for (const [k, t] of this.events) {
        if (t.event.detector !== 'D6' || t.event.field !== f.field || t.event.service !== f.service || t.event.endpoint !== `${f.method} ${f.endpoint}`) continue;
        if (seen.has(k) || ['resolved', 'expected', 'snoozed'].includes(t.event.state)) continue;
        t.event = { ...t.event, state: 'resolved', title: `${t.event.title} (explained: unit change)` };
        seen.add(k);
        changed.push(t.event);
      }
    }
    // The provider went back to normal: a confirmed change that is no longer found for RECOVER_RUNS passes in a row,
    // while its endpoint has enough traffic to judge, is closed as resolved (and its baseline unfreezes).
    // No traffic means no evidence either way, so the count only moves when the endpoint was actually observed.
    const minSamples = { ...DEFAULT_CTX, ...this.opts.ctx }.minSamples;
    const observed = new Set(wins.filter((w) => w.samples >= minSamples).map((w) => `${w.service}|${w.method} ${w.endpoint}`));
    for (const [k, t] of this.events) {
      if (seen.has(k)) { t.misses = 0; continue; }
      // a change that was FIXED and later went away (the provider went back): its period is set aside as well, or the
      // changed shape would stay in the baseline for hours and hide the next change to the same field (event stays resolved)
      if (t.event.state === 'resolved' && t.resolvedBy === 'fix' && !t.quarantine && observed.has(`${t.event.service}|${t.event.endpoint}`)) {
        t.misses = (t.misses ?? 0) + 1;
        if (t.misses >= RECOVER_RUNS) {
          const ep = `${t.event.service}|${t.event.endpoint}`;
          t.quarantine = [Date.parse(t.event.detectedAt) - this.opts.windowMs, now - this.opts.windowMs];
          t.resolvedBy = 'recovered';
          this.quarantine.set(ep, [...(this.quarantine.get(ep) ?? []), t.quarantine]);
          seen.add(k);
        }
        continue;
      }
      // any confirmed change, also one whose severity dropped to 'normal' while the provider was reverting (found by the
      // pipeline run: "New status value: lost" stayed on the timeline for good after the provider stopped sending it)
      if (t.runs < this.opts.confirmRuns || CLOSED.includes(t.event.state) || !observed.has(`${t.event.service}|${t.event.endpoint}`)) continue;
      t.misses = (t.misses ?? 0) + 1;
      if (t.misses < RECOVER_RUNS) { seen.add(k); continue; }
      const ep = `${t.event.service}|${t.event.endpoint}`;
      const from = Math.min(this.investigating.get(ep) ?? Infinity, Date.parse(t.event.detectedAt)) - this.opts.windowMs;
      this.quarantine.set(ep, [...(this.quarantine.get(ep) ?? []).filter(([, u]) => now - u < this.opts.baselineMs), [from, now - this.opts.windowMs]]);
      t.event = { ...t.event, state: 'resolved' };
      t.resolvedBy = 'recovered';
      t.quarantine = [from, now - this.opts.windowMs];
      seen.add(k);
      changed.push(t.event);
    }
    // A finding that vanished before it was confirmed was noise: forget it.
    const noise: string[] = [];
    for (const [key, t] of this.events) if (!seen.has(key) && t.runs < this.opts.confirmRuns) { noise.push(t.event.id); this.events.delete(key); }
    await this.persist(seen);
    if (noise.length) await this.store.remove(noise).catch(() => undefined);
    return changed;
  }
}

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
