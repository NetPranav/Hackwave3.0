// Overview data, derived from the same data as every other page so the numbers always agree.
// v2: functions of the live data (useSeismoData); the constants below keep the old mock values for mock mode.

import { FIX_RULES, type FixRuleData } from "./fixes";
import { REVIEW_ITEMS, type ReviewItem } from "./review";
import { SERVICES_STATUS_DATA, type DriftState, type ServiceStatusItem } from "./status";
import { TIMELINE_EVENTS, type TimelineDriftEvent, type TimelineItem } from "./timeline";

export interface OverviewInput {
  services: ServiceStatusItem[];
  timeline: TimelineItem[];
  fixes: FixRuleData[];
  review: ReviewItem[];
  codeMap: { fieldCoverage: number; callSites: number };
}

const driftsOf = (timeline: TimelineItem[]) => timeline.filter((i): i is TimelineDriftEvent => i.type === "drift");
const openPrsOf = (fixes: FixRuleData[]) => fixes.filter((f) => f.fixPrNumber && (f.status === "pr_open" || f.status === "ci_green"));

export function overviewStats(d: OverviewInput) {
  const drifts = driftsOf(d.timeline).filter((e) => e.state !== "resolved");
  return {
    apis: d.services.length,
    endpoints: d.services.reduce((n, s) => n + s.endpoints.length, 0),
    fieldCoverage: d.codeMap.fieldCoverage,
    callSites: d.codeMap.callSites,
    changes: d.services.filter((s) => s.state !== "normal").length,
    breaking: drifts.filter((e) => e.severity === "breaking").length,
    suspected: drifts.filter((e) => e.severity === "suspected").length,
    openPrNumbers: openPrsOf(d.fixes).map((f) => f.fixPrNumber as number),
    waitingForReview: d.review.length,
  };
}
export type OverviewStats = ReturnType<typeof overviewStats>;

/** Code-map figures come from the GitHub App scanner (P2); fixed here for mock mode. */
const MOCK_INPUT: OverviewInput = { services: SERVICES_STATUS_DATA, timeline: TIMELINE_EVENTS, fixes: FIX_RULES, review: REVIEW_ITEMS, codeMap: { fieldCoverage: 98.4, callSites: 186 } };
export const OVERVIEW_STATS = overviewStats(MOCK_INPUT);

// ---- Services table -------------------------------------------------------------------------

export type RowAction =
  | { type: "pr"; number: number }
  | { type: "review" }
  | { type: "status" };

export interface OverviewRow {
  id: string;
  traceId: string;
  name: string;
  slug: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  endpoint: string;
  callsPerMin: number;
  lastSeen: string;
  state: DriftState;
  diff: { before: string; after: string } | null;
  workflow: string;
  action: RowAction;
}

const RANK: Record<DriftState, number> = { changed: 0, under_review: 1, fix_pending: 2, normal: 3 };

export function overviewRows(d: OverviewInput): OverviewRow[] {
  const drifts = driftsOf(d.timeline).filter((e) => e.state !== "resolved");
  const openPrs = openPrsOf(d.fixes);
  const actionFor = (name: string, slug: string, state: DriftState): RowAction => {
    const pr = openPrs.find((f) => f.serviceSlug === slug);
    if (pr?.fixPrNumber) return { type: "pr", number: pr.fixPrNumber };
    if (state !== "normal" && d.review.some((r) => r.service === name)) return { type: "review" };
    return { type: "status" };
  };
  return d.services
    .map((svc, index) => {
      const endpoint = svc.endpoints.find((e) => e.state !== "normal") ?? svc.endpoints[0];
      const event = drifts.find((e) => e.serviceSlug === svc.slug);
      return {
        index,
        row: {
          id: svc.id,
          traceId: event?.id ?? svc.id,
          name: svc.name,
          slug: svc.slug,
          method: endpoint?.method ?? "GET",
          endpoint: endpoint?.path ?? "—",
          callsPerMin: svc.callsPerMin,
          lastSeen: svc.lastSeen,
          state: svc.state,
          diff: event?.diffSnippet ?? null,
          workflow: event?.impactedWorkflows[0] ?? "—",
          action: actionFor(svc.name, svc.slug, svc.state),
        } satisfies OverviewRow,
      };
    })
    .sort((a, b) => RANK[a.row.state] - RANK[b.row.state] || a.index - b.index)
    .map(({ row }) => row);
}
export const OVERVIEW_ROWS: OverviewRow[] = overviewRows(MOCK_INPUT);

// ---- Chart ----------------------------------------------------------------------------------

export type ChartMetric = "volume" | "latency" | "drifts";

/** Four 6-hour buckets per day (00, 06, 12, 18 UTC). `null` means the bucket has not happened yet. */
export interface ChartDay {
  date: string;
  volume: (number | null)[];
  latency: (number | null)[];
  drifts: (number | null)[];
  driftNotes?: (string | null)[];
}

export const CHART_DAYS: ChartDay[] = [
  { date: "OCT 05", volume: [2640, 3260, 3550, 2980], latency: [152, 168, 192, 176], drifts: [0, 0, 0, 0] },
  { date: "OCT 06", volume: [2300, 3840, 4220, 3070], latency: [160, 220, 272, 200], drifts: [0, 0, 0, 0] },
  { date: "OCT 07", volume: [1680, 2500, 3360, 3940], latency: [168, 184, 232, 216], drifts: [0, 0, 0, 0] },
  { date: "OCT 08", volume: [2780, 3650, 4420, 3460], latency: [208, 224, 240, 188], drifts: [0, 0, 0, 0] },
  { date: "OCT 09", volume: [2500, 3360, 4610, 3740], latency: [184, 240, 272, 232], drifts: [0, 0, 0, 0] },
  { date: "OCT 10", volume: [3070, 4030, 4320, 3650], latency: [168, 200, 224, 192], drifts: [0, 0, 0, 0] },
  {
    date: "OCT 11",
    volume: [2900, 4810, null, null],
    latency: [190, 245, null, null],
    drifts: [2, 4, null, null],
    driftNotes: ["Orders, Shipping", "+ Payments, Users", null, null],
  },
];

export const CHART_MAX: Record<ChartMetric, number> = { volume: 4800, latency: 400, drifts: 4 };
export const CHART_TICKS: Record<ChartMetric, string[]> = {
  volume: ["4.8k", "3.6k", "2.4k", "1.2k", "0"],
  latency: ["400ms", "300ms", "200ms", "100ms", "0ms"],
  drifts: ["4", "3", "2", "1", "0"],
};
export const BUCKET_LABELS = ["00:00", "06:00", "12:00", "18:00"];
