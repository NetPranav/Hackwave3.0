// Mock review queue, shaped like the review-item / ai-explanation contracts (P6). Replace with the real API later.
// The three demo scenarios: unit change (paise), enum expansion, silent truncation.

export type ReviewReason = "money" | "branching" | "persistence";

export const REVIEW_REASONS: Record<ReviewReason, { label: string; why: string }> = {
  money: { label: "MONEY", why: "Money is never fixed automatically." },
  branching: { label: "LOGIC", why: "Your code makes decisions based on this value, so a person has to choose." },
  persistence: { label: "SAVED DATA", why: "Your app saves this data, so it is never rewritten automatically." },
};

export interface ReviewSuggestion {
  kind: "alias" | "transform" | "behaviour";
  summary: string;
  /** The suggested change as data, produced by deterministic templates, never by the AI. */
  rule: string;
  note: string;
}

export interface ReviewItem {
  id: string;
  driftId: string;
  service: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  endpoint: string;
  detectorId: string;
  detectorName: string;
  reason: ReviewReason;
  title: string;
  detectedAt: string;
  confidence: number;
  before: string;
  after: string;
  aiExplanation: string;
  aiModel: string;
  aiLatencyMs: number;
  templateExplanation: string;
  suggestion: ReviewSuggestion;
  impactedWorkflows: string[];
}

export const REVIEW_ITEMS: ReviewItem[] = [
  {
    id: "rv_payments_amount_paise",
    driftId: "drf_payments_amount_paise",
    service: "Payments Gateway",
    method: "POST",
    endpoint: "/payments",
    detectorId: "D5",
    detectorName: "Unit change",
    reason: "money",
    title: "Amount now arrives in paise (×100)",
    detectedAt: "12m ago",
    confidence: 99,
    before: "amount: 499 (rupees)",
    after: "amount: 49900 (paise)",
    aiExplanation:
      "The provider switched 'amount' from rupees to paise. Code that reads it as rupees would charge or record 100 times the intended value. Because this is a money field, Seismo will not patch it automatically.",
    aiModel: "NVIDIA NIM · Nemotron-3 Ultra",
    aiLatencyMs: 1840,
    templateExplanation:
      "'amount' on POST /payments became 100 times bigger (typically 499, now 49,900). This looks like a unit change. Money always needs a person to review it.",
    suggestion: {
      kind: "transform",
      summary: "Convert paise to rupees where the app reads amount",
      rule: '{ "kind": "transform", "endpoint": "POST /payments", "path": "$.amount", "op": "divide", "by": 100 }',
      note: "Check every place that uses it before merging: this touches money.",
    },
    impactedWorkflows: ["Order Payment Authorization", "Refund Ledger"],
  },
  {
    id: "rv_shipping_status_enum",
    driftId: "drf_shipping_enum_sunset",
    service: "Shipping & Logistics",
    method: "GET",
    endpoint: "/shipments/{id}",
    detectorId: "D7",
    detectorName: "New option added",
    reason: "branching",
    title: "New status 'partially_shipped' appeared",
    detectedAt: "36m ago",
    confidence: 92,
    before: "status: pending | shipped | delivered",
    after: "status: + partially_shipped (14% of responses)",
    aiExplanation:
      "A new status value is now returned. Code that switches on 'status' may fall through to its default branch and show the wrong tracking state. A person should decide how Order Tracking treats partially_shipped.",
    aiModel: "NVIDIA NIM · Nemotron-3 Ultra",
    aiLatencyMs: 1620,
    templateExplanation:
      "'status' on GET /shipments/{id} now returns a value your code does not know: partially_shipped (in 14% of responses).",
    suggestion: {
      kind: "behaviour",
      summary: "Handle the new value in the status switch",
      rule: '{ "kind": "behaviour", "endpoint": "GET /shipments/{id}", "path": "$.status", "add_case": "partially_shipped" }',
      note: "A person decides what the UI shows for a partial shipment.",
    },
    impactedWorkflows: ["Order Tracking UI", "Carrier Dispatch"],
  },
  {
    id: "rv_orders_limit_truncation",
    driftId: "drf_orders_limit_truncation",
    service: "Orders Engine",
    method: "GET",
    endpoint: "/orders",
    detectorId: "D9",
    detectorName: "Results cut short",
    reason: "persistence",
    title: "limit=500 now silently returns 100 items",
    detectedAt: "59m ago",
    confidence: 98,
    before: "limit=500 → 500 items",
    after: "limit=500 → 100 items",
    aiExplanation:
      "The server now caps page size at 100 without raising an error. A batch sync that asks for 500 records quietly stores only 100, so 400 records are never saved.",
    aiModel: "NVIDIA NIM · Nemotron-3 Ultra",
    aiLatencyMs: 1710,
    templateExplanation:
      "GET /orders with limit=500 returned at most 100 items every time we looked, with no error.",
    suggestion: {
      kind: "behaviour",
      summary: "Page through results until a short page comes back",
      rule: '{ "kind": "behaviour", "endpoint": "GET /orders", "param": "limit", "observed_max": 100, "action": "paginate" }',
      note: "Changes how records are stored, so review how the pages are fetched first.",
    },
    impactedWorkflows: ["Warehouse Inventory Sync"],
  },
];
