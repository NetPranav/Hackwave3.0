import type { CodeMap } from '@seismo/contracts';
import type { Finding } from './detectors/index.js';

const WEIGHT = { display: 0.3, read: 0.3, outbound: 0.6, arithmetic: 0.7, persistence: 0.8, branching: 0.9 } as const;
const norm = (e: string) => e.replace(/\{[^}]+\}/g, '{id}');

export interface Usage { file: string; line: number; kind: string; money: boolean }

/** Code locations that read `finding.field` of this endpoint (or any read of the endpoint for endpoint-level findings). */
export function usagesFor(f: Finding, maps: CodeMap[]): Usage[] {
  const out: Usage[] = [];
  for (const m of maps) {
    const sites = m.callSites.filter((c) => !c.unresolved && c.service === f.service && c.method === f.method && norm(c.endpoint) === norm(f.endpoint));
    const ids = new Set(sites.map((s) => s.id));
    for (const r of m.fieldReads) {
      if (!ids.has(r.callSiteId)) continue;
      if (f.field && r.field !== f.field && !r.field.startsWith(`${f.field}.`) && !r.field.startsWith(`${f.field}[]`)) continue;
      out.push({ file: r.file, line: r.line, kind: r.usage, money: r.money });
    }
    if (!f.field) for (const s of sites) if (!out.some((u) => u.file === s.file && u.line === s.line)) out.push({ file: s.file, line: s.line, kind: 'call', money: false });
  }
  return out;
}

/** severity = confidence × impact × exposure (docs/PS/architecture.md §7). */
export function score(f: Finding, usages: Usage[]) {
  let impact: number;
  if (usages.length === 0) impact = 0.05;                          // nobody reads it
  else if (!f.field) impact = 0.5;                                  // endpoint-level signal, code calls the endpoint
  else impact = Math.max(...usages.map((u) => (u.money ? 1 : WEIGHT[u.kind as keyof typeof WEIGHT] ?? 0.3)));
  // A field that disappears and is read anywhere breaks that read (undefined), whatever the usage kind.
  if ((f.detector === 'D1' || f.detector === 'D3') && usages.length > 0) impact = Math.max(impact, 0.6);
  const value = f.confidence * impact * f.exposure;
  const label = value >= 0.5 ? 'breaking' : value >= 0.15 ? 'warning' : 'info';
  return { value: Math.round(value * 100) / 100, label, impact } as const;
}
