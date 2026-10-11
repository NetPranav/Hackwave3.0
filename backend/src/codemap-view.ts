import type { CodeMap, DriftEvent } from '@seismo/contracts';
import { matches } from './graph.js';

/**
 * v2-P3: what the dashboard needs from the code maps, computed when served (stored events stay as detected):
 * every usage gets its repo, the source line, the workflows its file belongs to and a GitHub link.
 */
type Usage = DriftEvent['usages'][number];

export function workflowsOf(map: CodeMap, file: string): string[] {
  return map.workflows.filter((w) => matches(w.globs, file)).map((w) => w.name);
}

export function enrichUsages(usages: Usage[], maps: CodeMap[]): Usage[] {
  return usages.map((u) => {
    for (const m of maps) {
      const read = m.fieldReads.find((r) => r.file === u.file && r.line === u.line);
      const site = read ? undefined : m.callSites.find((c) => c.file === u.file && c.line === u.line);
      if (!read && !site) continue;
      return {
        ...u,
        repo: m.repo,
        ...(read?.snippet ? { snippet: read.snippet } : {}),
        workflows: workflowsOf(m, u.file),
        url: u.url ?? (m.repo.includes('/') ? `https://github.com/${m.repo}/blob/${m.commit}/${u.file}#L${u.line}` : undefined),
      };
    }
    return u;
  });
}

export function enrichEvent<T extends DriftEvent>(e: T, maps: CodeMap[]): T {
  return { ...e, usages: enrichUsages(e.usages, maps) };
}

/** GET /v1/codemap: the merged code maps with workflows resolved per read (no API data in here, only code locations). */
export function codemapView(maps: CodeMap[]) {
  return {
    repos: maps.map((m) => ({ repo: m.repo, commit: m.commit, scannedAt: m.scannedAt })),
    callSites: maps.flatMap((m) => m.callSites.map((c) => ({ ...c, workflows: workflowsOf(m, c.file) }))),
    fieldReads: maps.flatMap((m) => m.fieldReads.map((r) => ({ ...r, repo: m.repo, workflows: workflowsOf(m, r.file) }))),
    workflows: maps.flatMap((m) => m.workflows.map((w) => ({ id: w.id, name: w.name, file: w.file, repo: m.repo }))),
  };
}
