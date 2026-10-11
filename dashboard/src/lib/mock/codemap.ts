// Mock code map, shaped like the codemap contract (P2): where the customer's code reads each API field.
// Used by Compare & Simulate to answer "what would this change hit?".

import { DRIFT_DETAILS_MAP, type CodeSite } from "./drift";

export type { CodeSite };

const SITES: Record<string, CodeSite[]> = {
  "users:name": DRIFT_DETAILS_MAP.drf_users_name_rename.codeSites,
  "users:email": [
    {
      file: "services/mailer.ts",
      line: 19,
      usageKind: "display",
      snippet: "to: user.email,",
      workflow: "Order Receipts",
    },
  ],
  "payments:amount": DRIFT_DETAILS_MAP.drf_payments_amount_paise.codeSites,
  "payments:currency": [
    {
      file: "services/checkout.ts",
      line: 70,
      usageKind: "money",
      snippet: "currency: payment.currency,",
      workflow: "Order Payment Authorization",
    },
  ],
  "shipping:status": [
    {
      file: "components/tracking/StatusBadge.tsx",
      line: 34,
      usageKind: "branching",
      snippet: 'switch (shipment.status) { case "pending": return <Pending />;',
      workflow: "Order Tracking UI",
    },
    {
      file: "services/dispatch.ts",
      line: 77,
      usageKind: "branching",
      snippet: 'if (shipment.status === "shipped") notifyCarrier(shipment);',
      workflow: "Carrier Dispatch",
    },
  ],
  "orders:limit": [
    {
      file: "jobs/inventorySync.ts",
      line: 41,
      usageKind: "persistence",
      snippet: "const page = await orders.list({ limit: 500 });",
      workflow: "Warehouse Inventory Sync",
    },
    {
      file: "jobs/inventorySync.ts",
      line: 58,
      usageKind: "persistence",
      snippet: "await db.upsertMany(page.items);",
      workflow: "Warehouse Inventory Sync",
    },
  ],
};

/** Reads the static scanner could not resolve (computed keys, spreads). Shown, never hidden: honest about its limits. */
export const UNRESOLVED_READS: { file: string; line: number; reason: string }[] = [
  { file: "lib/api/dynamic.ts", line: 12, reason: "Computed property access: response[key]" },
  { file: "services/export.ts", line: 88, reason: "Object spread of the whole response" },
];

/** Call sites that read `field` of a service's API. Empty means nothing in the code depends on it. */
export function sitesFor(serviceSlug: string, field: string): CodeSite[] {
  return SITES[serviceSlug + ":" + field] ?? [];
}
