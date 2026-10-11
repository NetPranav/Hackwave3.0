import type { AliasRule, CodeMap, DriftEvent, DriftState } from '@seismo/contracts';
import { buildBaselines } from './baseline.js';
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
export const ENGINE_DEFAULTS: EngineOptions = { windowMs: 60_000, baselineMs: 24 * 3600_000, minBaselineSamples: 50, confirmRuns: 2 };

type Tracked = Omit<StoredEvent, 'key'>;

const OPEN_CONFIRMED = (t: Tracked, confirmRuns: number) => t.runs >= confirmRuns && ['breaking', 'suspected', 'fix_pending'].includes(t.event.state);

/** Opens fix PRs on the customer's repo (the GitHub App). Optional: without it, renames stay "breaking" with a suggested rule. */
export interface FixDispatcher {
  existingRules(repo: string): Promise<AliasRule[]>;
  openPr(i: { repo: string; rule: AliasRule; checks: CheckResult[]; usages: { file: string; line: number }[]; eventId: string }): Promise<{ url: string; number: number }>;
}

/** Runs the detectors over stored fingerprints and keeps drift events with their state machine (suspected -> confirmed). */
export class DriftEngine {
  private events = new Map<string, Tracked>();
  private loaded?: Promise<void>;
  constructor(private ingest: IngestStore, private maps: () => Promise<CodeMap[]>, private opts: EngineOptions = ENGINE_DEFAULTS, private fixer?: FixDispatcher, private store: EventStore = memoryEvents()) {}

  /** Load remembered events (once). Call at startup so list() is complete before the first detection pass. */
  init(): Promise<void> {
    this.loaded ??= this.store.load().then((items) => { for (const i of items) if (!this.events.has(i.key)) this.events.set(i.key, { event: i.event, runs: i.runs, lastSeen: i.lastSeen, dispatched: i.dispatched, reviewReason: i.reviewReason }); }).catch(() => undefined);
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

  list(): DriftEvent[] {
    return [...this.events.values()].map((t) => t.event).sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  }

  /** A fix PR was merged/closed (GitHub webhook): resolve the event whose rule id matches. */
  resolveByRule(ruleId: string, merged: boolean): DriftEvent | undefined {
    for (const t of this.events.values()) {
      if (t.event.fix?.rule?.id !== ruleId) continue;
      t.event = { ...t.event, state: merged ? 'resolved' : 'breaking' };
      if (!merged) t.dispatched = false;
      void this.persist([this.keyOf(t.event.id)!]);
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
    const all = await this.ingest.since('dev', now - this.opts.baselineMs);
    const cut = now - this.opts.windowMs;
    // Baseline freeze: while a confirmed change is open on an endpoint, traffic from after it started (detection time minus
    // one window) never becomes "history" for that endpoint. Otherwise a restart, or simply time passing, would teach the
    // baseline the broken shape and the change would stop being reported.
    const frozen = new Map<string, number>();
    for (const t of this.events.values()) {
      if (!OPEN_CONFIRMED(t, this.opts.confirmRuns)) continue;
      const ep = `${t.event.service}|${t.event.endpoint}`;
      const from = Date.parse(t.event.detectedAt) - this.opts.windowMs;
      frozen.set(ep, Math.min(frozen.get(ep) ?? Infinity, from));
    }
    const baseFps = all.filter((f) => {
      const end = Date.parse(f.windowStart) + f.windowSeconds * 1000;
      if (end >= cut) return false;
      const since = frozen.get(`${f.service}|${f.method} ${f.endpoint}`);
      return since === undefined || Date.parse(f.windowStart) < since;
    });
    const winFps = all.filter((f) => Date.parse(f.windowStart) + f.windowSeconds * 1000 >= cut);
    const bases = buildBaselines(baseFps, now), wins = buildBaselines(winFps, now);
    const maps = await this.maps();

    const findings: Finding[] = [];
    const ctxOf = new Map<Finding, { base: ReturnType<typeof buildBaselines>[number]; win: ReturnType<typeof buildBaselines>[number] }>();
    for (const w of wins) {
      const b = bases.find((x) => x.service === w.service && x.method === w.method && x.endpoint === w.endpoint && x.statusClass === w.statusClass);
      if (b && b.samples >= this.opts.minBaselineSamples) for (const f of runDetectors(b, w, { ...DEFAULT_CTX, ...this.opts.ctx })) { findings.push(f); ctxOf.set(f, { base: b, win: w }); }
    }
    const basesAll = buildBaselines(baseFps, now, true);
    for (const w of buildBaselines(winFps, now, true)) {
      const b = basesAll.find((x) => x.service === w.service && x.method === w.method && x.endpoint === w.endpoint);
      if (b && b.samples >= this.opts.minBaselineSamples) for (const f of runStatusMixDetectors(b, w, { ...DEFAULT_CTX, ...this.opts.ctx })) { findings.push(f); ctxOf.set(f, { base: b, win: w }); }
    }

    const changed: DriftEvent[] = [];
    const seen = new Set<string>();
    for (const f of findings) {
      const key = `${f.service}|${f.method}|${f.endpoint}|${f.detector}|${f.field ?? f.title}`;
      seen.add(key);
      const usages = usagesFor(f, maps);
      const s = score(f, usages);
      const prev = this.events.get(key);
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
          const plan = planAlias({ finding: f, base: c.base, win: c.win, maps, existingRules: repo && this.fixer ? await this.fixer.existingRules(repo).catch(() => []) : [], eventId: event.id });
          if (!plan.ok) tracked.reviewReason = plan.reason;
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
    // A finding that vanished before it was confirmed was noise: forget it.
    const noise: string[] = [];
    for (const [key, t] of this.events) if (!seen.has(key) && t.runs < this.opts.confirmRuns) { noise.push(t.event.id); this.events.delete(key); }
    await this.persist(seen);
    if (noise.length) await this.store.remove(noise).catch(() => undefined);
    return changed;
  }
}

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
