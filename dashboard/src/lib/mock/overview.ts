// Overview data, derived from the same mocks as every other page so the numbers always agree.
// Only the chart series, the short diff labels and the code-map figures are authored here.

import { FIX_RULES } from "./fixes";
import { REVIEW_ITEMS } from "./review";
import { SERVICES_STATUS_DATA, type DriftState } from "./status";
import { TIMELINE_EVENTS, type TimelineDriftEvent } from "./timeline";

const drifts = TIMELINE_EVENTS.filter((i): i is TimelineDriftEvent => i.type !== "deploy");

/** Code-map figures come from the GitHub App scanner (P2); fixed here. */
const CODE_MAP = { fieldCoverage: 98.4, callSites: 186 };

const openPrs = FIX_RULES.filter((f) => f.fixPrNumber && (f.status === "pr_open" || f.status === "ci_green"));

export const OVERVIEW_STATS = {
  apis: SERVICES_STATUS_DATA.length,
  endpoints: SERVICES_STATUS_DATA.reduce((n, s) => n + s.endpoints.length, 0),
  fieldCoverage: CODE_MAP.fieldCoverage,
  callSites: CODE_MAP.callSites,
  changes: SERVICES_STATUS_DATA.filter((s) => s.state !== "normal").length,
  breaking: drifts.filter((e) => e.severity === "breaking").length,
  suspected: drifts.filter((e) => e.severity === "suspected").length,
  openPrNumbers: openPrs.map((f) => f.fixPrNumber as number),
  waitingForReview: REVIEW_ITEMS.length,
};

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

const SHORT_DIFF: Record<string, { before: string; after: string }> = {
  users: { before: "name", after: "display_name" },
  payments: { before: "amount ₹", after: "amount paise" },
  shipping: { before: "status (3)", after: "status (4)" },
  orders: { before: "limit 500", after: "limit 100" },
};

/** Workflows for APIs with no change; the changed ones take theirs from the timeline. */
const QUIET_WORKFLOW: Record<string, string> = {
  inventory: "Stock Levels",
  notifications: "Order Notifications",
  ai: "Smart Replies",
};

const TRACE_IDS: Record<string, string> = {
  users: "trc_8e45b6060ad",
  payments: "trc_782cb64292e",
  shipping: "trc_164e81eb4a0",
  orders: "trc_5fe0281b99a",
  inventory: "trc_9aa47cc510f",
  notifications: "trc_3b71d09e4c2",
  ai: "trc_c20f8a6d715",
};

const RANK: Record<DriftState, number> = { changed: 0, under_review: 1, fix_pending: 2, normal: 3 };

function actionFor(name: string, slug: string, state: DriftState): RowAction {
  const pr = openPrs.find((f) => f.serviceSlug === slug);
  if (pr?.fixPrNumber) return { type: "pr", number: pr.fixPrNumber };
  if (state !== "normal" && REVIEW_ITEMS.some((r) => r.service === name)) return { type: "review" };
  return { type: "status" };
}

export const OVERVIEW_ROWS: OverviewRow[] = SERVICES_STATUS_DATA.map((svc, index) => {
  const endpoint = svc.endpoints.find((e) => e.state !== "normal") ?? svc.endpoints[0];
  const event = drifts.find((e) => e.serviceSlug === svc.slug);
  return {
    index,
    row: {
      id: svc.id,
      traceId: TRACE_IDS[svc.slug] ?? "trc_000000000",
      name: svc.name,
      slug: svc.slug,
      method: endpoint.method,
      endpoint: endpoint.path,
      callsPerMin: svc.callsPerMin,
      lastSeen: svc.lastSeen,
      state: svc.state,
      diff: SHORT_DIFF[svc.slug] ?? null,
      workflow: event?.impactedWorkflows[0] ?? QUIET_WORKFLOW[svc.slug] ?? "General traffic",
      action: actionFor(svc.name, svc.slug, svc.state),
    } satisfies OverviewRow,
  };
})
  .sort((a, b) => RANK[a.row.state] - RANK[b.row.state] || a.index - b.index)
  .map(({ row }) => row);

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
