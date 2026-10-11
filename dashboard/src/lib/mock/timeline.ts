// Mock timeline, shaped like the drift-event contract (P4). Replace with the real API later.
// Times are fixed so server and client render the same thing.

export const TIMELINE_WINDOW_START = Date.parse("2026-10-11T03:45:00Z");
export const TIMELINE_BUCKET_MS = 15 * 60 * 1000;
export const TIMELINE_BUCKETS = 12;
export const TIMELINE_NOW = Date.parse("2026-10-11T06:34:00Z");

export type EventSeverity = "breaking" | "suspected" | "info" | "resolved";
export type EventState = "confirmed" | "fix_pending" | "under_review" | "resolved";

export interface TimelineDriftEvent {
  id: string;
  type: "drift" | "radar";
  service: string;
  serviceSlug: string;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  field: string;
  detectorId: string;
  detectorName: string;
  title: string;
  description: string;
  timestamp: string;
  relativeTime: string;
  severity: EventSeverity;
  state: EventState;
  confidence: number; // 0 - 100
  impactedWorkflows: string[];
  impactedFilesCount: number;
  fixPrNumber?: number;
  fixType?: "alias" | "review";
  diffSnippet?: {
    before: string;
    after: string;
  };
}

export interface TimelineDeployMarker {
  id: string;
  type: "deploy";
  commitHash: string;
  commitMessage: string;
  author: string;
  timestamp: string;
  relativeTime: string;
}

export type TimelineItem = TimelineDriftEvent | TimelineDeployMarker;

export const TIMELINE_EVENTS: TimelineItem[] = [
  {
    id: "drf_users_name_rename",
    type: "drift",
    service: "Users API",
    serviceSlug: "users",
    endpoint: "/users/{id}",
    method: "GET",
    field: "name → display_name",
    detectorId: "D3",
    detectorName: "Field Rename",
    title: "Field 'name' renamed to 'display_name'",
    description:
      "The field 'name' disappeared and a new field 'display_name' appeared holding the same kind of text. Any code that reads 'name' now gets nothing.",
    timestamp: "2026-10-11T06:30:10Z",
    relativeTime: "4m ago",
    severity: "breaking",
    state: "fix_pending",
    confidence: 96,
    impactedWorkflows: ["Invoice Generation", "Checkout Settlement"],
    impactedFilesCount: 3,
    fixPrNumber: 104,
    fixType: "alias",
    diffSnippet: {
      before: '"name": "Aarav Sharma"',
      after: '"display_name": "Aarav Sharma"',
    },
  },
  {
    id: "drf_payments_amount_paise",
    type: "drift",
    service: "Payments Gateway",
    serviceSlug: "payments",
    endpoint: "/payments",
    method: "POST",
    field: "amount",
    detectorId: "D5",
    detectorName: "Unit change",
    title: "'amount' became 100 times bigger",
    description:
      "The typical 'amount' went from 499 to 49,900. The provider switched from rupees to paise. Money fields are never fixed automatically, so this needs a person.",
    timestamp: "2026-10-11T06:21:40Z",
    relativeTime: "12m ago",
    severity: "breaking",
    state: "under_review",
    confidence: 99,
    impactedWorkflows: ["Order Payment Authorization", "Refund Ledger"],
    impactedFilesCount: 4,
    fixType: "review",
    diffSnippet: {
      before: '"amount": 499          // rupees',
      after: '"amount": 49900        // paise, 100 times bigger',
    },
  },
  {
    id: "dep_deploy_commit_40bc",
    type: "deploy",
    commitHash: "40bcba1",
    commitMessage: "Merge main: seismo-demo-shop cart and checkout flow updates",
    author: "adarzhpathade",
    timestamp: "2026-10-11T06:14:00Z",
    relativeTime: "20m ago",
  },
  {
    id: "drf_shipping_enum_sunset",
    type: "drift",
    service: "Shipping & Logistics",
    serviceSlug: "shipping",
    endpoint: "/shipments/{id}",
    method: "GET",
    field: "status + shutdown date",
    detectorId: "D7 & D13",
    detectorName: "New option + shutdown date",
    title: "New status 'partially_shipped' and a shutdown date",
    description:
      "A new status 'partially_shipped' appears in 14% of responses. The provider also announced that shipments v1 shuts down on 2026-11-01.",
    timestamp: "2026-10-11T05:58:30Z",
    relativeTime: "36m ago",
    severity: "suspected",
    state: "confirmed",
    confidence: 92,
    impactedWorkflows: ["Order Tracking UI", "Carrier Dispatch"],
    impactedFilesCount: 2,
    fixType: "review",
    diffSnippet: {
      before: 'status: "pending" | "shipped" | "delivered"',
      after: 'status: "partially_shipped"  // a new option your code does not know',
    },
  },
  {
    id: "drf_orders_limit_truncation",
    type: "drift",
    service: "Orders Engine",
    serviceSlug: "orders",
    endpoint: "/orders?limit=&page=",
    method: "GET",
    field: "limit & items[]",
    detectorId: "D9",
    detectorName: "Results cut short",
    title: "Server silently lowered the limit from 500 to 100",
    description:
      "Asking for 500 items now returns only 100, with no error. The batch sync silently drops the other 400 records.",
    timestamp: "2026-10-11T05:35:10Z",
    relativeTime: "59m ago",
    severity: "breaking",
    state: "under_review",
    confidence: 98,
    impactedWorkflows: ["Warehouse Inventory Sync"],
    impactedFilesCount: 2,
    fixType: "review",
    diffSnippet: {
      before: "GET /orders?limit=500  → 500 items returned",
      after: "GET /orders?limit=500  → 100 items returned (silent server clamp)",
    },
  },
  {
    id: "drf_users_email_info",
    type: "drift",
    service: "Users API",
    serviceSlug: "users",
    endpoint: "/users",
    method: "GET",
    field: "gravatar_hash",
    detectorId: "D1",
    detectorName: "Unused field removed",
    title: "Field 'gravatar_hash' removed by the provider",
    description:
      "Nothing in your code uses 'gravatar_hash', so this is only noted as info. No alert was sent.",
    timestamp: "2026-10-11T04:40:00Z",
    relativeTime: "2h ago",
    severity: "info",
    state: "resolved",
    confidence: 100,
    impactedWorkflows: [],
    impactedFilesCount: 0,
    diffSnippet: {
      before: '"gravatar_hash": "a8f7c9e120bc..."',
      after: "// removed by the provider (nothing in your code reads it)",
    },
  },
];
