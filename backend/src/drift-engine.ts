import type { CodeMap, DriftEvent, DriftState } from '@seismo/contracts';
import { buildBaselines } from './baseline.js';
import { runDetectors, type Finding } from './detectors/index.js';
import type { IngestStore } from './ingest-store.js';
import { score, usagesFor } from './severity.js';

export interface EngineOptions {
  windowMs: number;          // recent window compared against the baseline
  baselineMs: number;        // history before the window
  minBaselineSamples: number;
  confirmRuns: number;       // consecutive runs a finding must persist before it is confirmed
}
export const ENGINE_DEFAULTS: EngineOptions = { windowMs: 60_000, baselineMs: 24 * 3600_000, minBaselineSamples: 50, confirmRuns: 2 };

interface Tracked { event: DriftEvent; runs: number; lastSeen: number }

/** Runs the detectors over stored fingerprints and keeps drift events with their state machine (suspected -> confirmed). */
export class DriftEngine {
  private events = new Map<string, Tracked>();
  constructor(private ingest: IngestStore, private maps: () => Promise<CodeMap[]>, private opts: EngineOptions = ENGINE_DEFAULTS) {}

  list(): DriftEvent[] {
    return [...this.events.values()].map((t) => t.event).sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  }

  setState(id: string, state: DriftState) {
    for (const t of this.events.values()) if (t.event.id === id) t.event = { ...t.event, state };
  }

  /** One detection pass. Returns the events that were created or changed in this pass. */
  async run(now = Date.now()): Promise<DriftEvent[]> {
    const all = await this.ingest.since('dev', now - this.opts.baselineMs);
    const cut = now - this.opts.windowMs;
    const baseFps = all.filter((f) => Date.parse(f.windowStart) + f.windowSeconds * 1000 < cut);
    const winFps = all.filter((f) => Date.parse(f.windowStart) + f.windowSeconds * 1000 >= cut);
    const bases = buildBaselines(baseFps, now), wins = buildBaselines(winFps, now);
    const maps = await this.maps();

    const findings: Finding[] = [];
    for (const w of wins) {
      const b = bases.find((x) => x.service === w.service && x.method === w.method && x.endpoint === w.endpoint && x.statusClass === w.statusClass);
      if (b && b.samples >= this.opts.minBaselineSamples) findings.push(...runDetectors(b, w));
    }

    const changed: DriftEvent[] = [];
    const seen = new Set<string>();
    for (const f of findings) {
      const key = `${f.service}|${f.method}|${f.endpoint}|${f.detector}|${f.field ?? ''}`;
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
        ...(f.rung === 'alias' && f.rename ? { fix: { rung: 'alias' as const, rule: { endpoint: `${f.method} ${f.endpoint}`, source: f.rename.to, target: f.rename.from } } } : {}),
      };
      if (!prev || prev.event.state !== event.state || prev.event.severity !== event.severity) changed.push(event);
      this.events.set(key, { event, runs, lastSeen: now });
    }
    // A finding that vanished before it was confirmed was noise: forget it.
    for (const [key, t] of this.events) if (!seen.has(key) && t.runs < this.opts.confirmRuns) this.events.delete(key);
    return changed;
  }
}

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
