// Mock radar, shaped like the radar-item contract (P7). Replace with GET /v1/radar later.
// "Today" is fixed so server and client render the same thing.

export const RADAR_NOW = Date.parse("2026-10-11T00:00:00Z");

export type RadarKind = "deprecation" | "sunset" | "changelog" | "breaking" | "spec";
export type RadarSeverity = "info" | "warning" | "breaking";
export type RadarChangeType = "rename" | "removal" | "type" | "units" | "limit" | "pagination" | "deprecation" | "enum" | "other";
export type RadarExtractor = "ai" | "rules" | "header" | "spec";

/** The pre-filled "what if" this item opens in Compare and Simulate. Only set when the change maps to one. */
export interface RadarSimulation {
  endpoint: string;
  change: "rename" | "scale" | "enum" | "cap";
  field: string;
  value: string;
}

export interface RadarItem {
  id: string;
  service: string;
  serviceSlug: string;
  title: string;
  kind: RadarKind;
  changeType: RadarChangeType;
  date?: string; // effective date, YYYY-MM-DD
  source: string;
  sourceUrl?: string;
  quote?: string; // verbatim from the source
  endpoint?: string;
  field?: string;
  matchedFiles: string[]; // file:line of code that will be affected
  severity: RadarSeverity;
  suggestion: string; // fixed template text, never AI
  extractedBy: RadarExtractor;
  driftEventId?: string; // set when traffic later shows the change
  explanation: string; // AI text
  aiModel: string;
  simulation?: RadarSimulation;
}

export const RADAR_ITEMS: RadarItem[] = [
  {
    id: "rad_orders_limit_cap",
    service: "Orders Engine",
    serviceSlug: "orders",
    title: "The limit option will stop at 100",
    kind: "changelog",
    changeType: "limit",
    date: "2026-10-25",
    source: "Changelog (RSS)",
    sourceUrl: "https://github.com/NetPranav/seismo-demo-shop",
    quote: "From 25 October, the limit parameter on GET /orders is capped at 100.",
    endpoint: "/orders?limit=&page=",
    field: "limit",
    matchedFiles: ["lib/api/orders.ts:42"],
    severity: "breaking",
    suggestion: "Ask for pages of 100 or fewer and keep asking until a page comes back empty.",
    extractedBy: "ai",
    explanation:
      "Your order list asks for 500 items at once. After this date the server returns only 100 and says nothing, so the page would look complete while 400 orders are missing.",
    aiModel: "nemotron-3-super",
    simulation: { endpoint: "ep_orders_list", change: "cap", field: "limit", value: "100" },
  },
  {
    id: "rad_payments_units",
    service: "Payments Gateway",
    serviceSlug: "payments",
    title: "Amounts will be sent in the smallest coin unit",
    kind: "breaking",
    changeType: "units",
    date: "2026-11-20",
    source: "Changelog (RSS)",
    sourceUrl: "https://github.com/NetPranav/seismo-demo-shop",
    quote: "Starting 20 November, amount values are returned in the smallest currency unit.",
    endpoint: "/payments",
    field: "amount",
    matchedFiles: ["src/checkout/total.ts:88", "src/billing/invoice.ts:31"],
    severity: "breaking",
    suggestion: "Convert the value by hand in a reviewed change. Seismo will not change money fields on its own.",
    extractedBy: "ai",
    explanation:
      "The number keeps its name and type but gets 100 times bigger. Checkout and invoices would charge or show the wrong amount without any error.",
    aiModel: "nemotron-3-super",
    simulation: { endpoint: "ep_payments_charge", change: "scale", field: "amount", value: "100" },
  },
  {
    id: "rad_shipping_enum",
    service: "Shipping & Logistics",
    serviceSlug: "shipping",
    title: "A new shipment status is coming",
    kind: "changelog",
    changeType: "enum",
    date: "2026-11-12",
    source: "Changelog (RSS)",
    sourceUrl: "https://github.com/NetPranav/seismo-demo-shop",
    quote: "A new status value, partially_shipped, will appear on shipments from 12 November.",
    endpoint: "/shipments/{id}",
    field: "status",
    matchedFiles: ["src/orders/tracking.ts:57"],
    severity: "warning",
    suggestion: "Add a branch for the new value so your code does not fall through to a catch-all.",
    extractedBy: "rules",
    explanation:
      "Your tracking page decides what to show from this status. A value it has never seen could land in the default branch and show the wrong message.",
    aiModel: "nemotron-3-super",
    simulation: { endpoint: "ep_shipments_id", change: "enum", field: "status", value: "partially_shipped" },
  },
  {
    id: "rad_payments_sunset",
    service: "Payments Gateway",
    serviceSlug: "payments",
    title: "The old charges API will be switched off",
    kind: "sunset",
    changeType: "deprecation",
    date: "2026-12-01",
    source: "Sunset header",
    endpoint: "/payments",
    matchedFiles: ["src/pay.ts:14"],
    severity: "warning",
    suggestion: "Plan the move to the newer endpoint well before the date.",
    extractedBy: "header",
    explanation:
      "The provider has started sending a Sunset date on every response. After it, calls to this endpoint will stop working.",
    aiModel: "nemotron-3-super",
  },
  {
    id: "rad_inventory_deprecation",
    service: "Inventory Core",
    serviceSlug: "inventory",
    title: "Stock check is marked as deprecated",
    kind: "deprecation",
    changeType: "deprecation",
    source: "Deprecation header",
    endpoint: "/stock/{sku}",
    matchedFiles: ["lib/api/stock.ts:19"],
    severity: "info",
    suggestion: "No date yet. Watch this item and plan a move when one is announced.",
    extractedBy: "header",
    explanation:
      "The provider flagged this endpoint as old but has not said when it ends. Nothing breaks today.",
    aiModel: "nemotron-3-super",
  },
  {
    id: "rad_users_rename",
    service: "Users API",
    serviceSlug: "users",
    title: "The name field became display_name",
    kind: "spec",
    changeType: "rename",
    date: "2026-10-09",
    source: "OpenAPI diff",
    sourceUrl: "https://github.com/NetPranav/seismo-demo-shop",
    quote: "GET /users/{id}: property name removed, property display_name added.",
    endpoint: "/users/{id}",
    field: "name",
    matchedFiles: ["src/profile/header.ts:23", "src/account/menu.ts:11"],
    severity: "breaking",
    suggestion: "Add a safe alias so the old name keeps working while you move to the new one.",
    extractedBy: "spec",
    driftEventId: "drf_users_name_rename",
    explanation:
      "The provider's new spec renames this field. Real traffic now shows the change, so it moved from the radar to a confirmed change.",
    aiModel: "nemotron-3-super",
    simulation: { endpoint: "ep_users_id", change: "rename", field: "name", value: "display_name" },
  },
  {
    id: "rad_notifications_fyi",
    service: "Twilio Notifications",
    serviceSlug: "notifications",
    title: "Message logs will be kept for 30 days",
    kind: "changelog",
    changeType: "other",
    date: "2026-11-30",
    source: "Changelog (RSS)",
    sourceUrl: "https://github.com/NetPranav/seismo-demo-shop",
    quote: "Message logs will be kept for 30 days instead of 90.",
    matchedFiles: [],
    severity: "info",
    suggestion: "Nothing to change. No code of yours reads old message logs.",
    extractedBy: "ai",
    explanation: "This is good to know, not a problem. We found no code that depends on old logs.",
    aiModel: "nemotron-3-super",
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from "today" to the item's date. Negative means it is already live. Undefined when there is no date. */
export function daysUntil(item: RadarItem): number | undefined {
  return item.date === undefined ? undefined : Math.round((Date.parse(item.date + "T00:00:00Z") - RADAR_NOW) / DAY_MS);
}
