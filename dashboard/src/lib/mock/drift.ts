// Mock drift details, shaped like the drift-event contract (P4/P5). Replace with the real API later.

export interface CodeSite {
  file: string;
  line: number;
  usageKind: string;
  snippet: string;
  workflow: string;
}

export interface DriftDetailData {
  id: string;
  service: string;
  serviceSlug: string;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  field: string;
  detectorId: string;
  detectorName: string;
  confidence: number;
  severity: "breaking" | "suspected" | "info";
  state: "fix_pending" | "under_review" | "resolved" | "confirmed";
  detectedAt: string;
  samplesObserved: number;
  presenceShift: {
    baseline: string;
    current: string;
  };
  magnitudeShift?: {
    baseline: string;
    current: string;
  };
  baselinePayload: Record<string, unknown>;
  observedPayload: Record<string, unknown>;
  codeSites: CodeSite[];
  detectorReasoning: string;
  aiExplanation: string;
  aiModelBadge: string;
  safetyLadderRung: "Rung 1: Additive Alias" | "Rung 2: Transform (Review Only)" | "Rung 3: Behaviour Change";
  aliasRule: {
    endpoint: string;
    source: string;
    target: string;
  };
  checks: {
    id: string;
    label: string;
    passed: boolean;
  }[];
  fixPrNumber?: number;
}

export const DRIFT_DETAILS_MAP: Record<string, DriftDetailData> = {
  drf_users_name_rename: {
    id: "drf_users_name_rename",
    service: "Users API",
    serviceSlug: "users",
    endpoint: "/users/{id}",
    method: "GET",
    field: "name → display_name",
    detectorId: "D3",
    detectorName: "Field rename",
    confidence: 96,
    severity: "breaking",
    state: "fix_pending",
    detectedAt: "4m ago (06:30 IST)",
    samplesObserved: 1420,
    presenceShift: {
      baseline: "name: 100% · display_name: 0%",
      current: "name: 0% · display_name: 100%",
    },
    baselinePayload: {
      id: "usr_91b72e0a",
      name: "Aarav Sharma",
      email: "aarav.sharma@example.com",
      role: "admin",
      created_at: "2026-03-15T09:20:00Z",
    },
    observedPayload: {
      id: "usr_91b72e0a",
      display_name: "Aarav Sharma",
      email: "aarav.sharma@example.com",
      role: "admin",
      created_at: "2026-03-15T09:20:00Z",
    },
    codeSites: [
      {
        file: "lib/api/users.ts",
        line: 42,
        usageKind: "display",
        snippet: "const username = response.data.name;",
        workflow: "Customer Profile Rendering",
      },
      {
        file: "services/invoice.ts",
        line: 108,
        usageKind: "persistence + display",
        snippet: "doc.text(`Billed to: ${user.name}`, 20, 40);",
        workflow: "Invoice PDF Generation",
      },
      {
        file: "components/checkout/AddressSummary.tsx",
        line: 29,
        usageKind: "display",
        snippet: "<span>Recipient: {recipient.name}</span>",
        workflow: "Checkout / Settlement",
      },
    ],
    detectorReasoning:
      "'name' went from 100% of responses to 0%, while 'display_name' went from 0% to 100%. Both hold the same kind of text (about 14 characters) and the values look 96% alike, so this is almost certainly a rename.",
    aiExplanation:
      "The external user service renamed the primary customer name field from 'name' to 'display_name'. In your client repository, 'services/invoice.ts' directly references 'user.name'. Without adaptation, invoices will render customer names as 'undefined'.",
    aiModelBadge: "NVIDIA NIM · Nemotron-3 Ultra (550B)",
    safetyLadderRung: "Rung 1: Additive Alias",
    aliasRule: {
      endpoint: "/users/{id}",
      source: "display_name",
      target: "name",
    },
    checks: [
      { id: "C1", label: "The new field 'display_name' really is in the responses", passed: true },
      { id: "C2", label: "The old field 'name' is missing, so nothing gets overwritten", passed: true },
      { id: "C3", label: "The fix does not point back at itself", passed: true },
      { id: "C4", label: "Both fields hold the same kind of data (text)", passed: true },
      { id: "C5", label: "The fix only adds a field, and that is tested automatically", passed: true },
      { id: "C6", label: "Not a money field, so an automatic PR is allowed", passed: true },
    ],
    fixPrNumber: 104,
  },
  drf_payments_amount_paise: {
    id: "drf_payments_amount_paise",
    service: "Payments Gateway",
    serviceSlug: "payments",
    endpoint: "/payments",
    method: "POST",
    field: "amount",
    detectorId: "D5",
    detectorName: "Unit change",
    confidence: 99,
    severity: "breaking",
    state: "under_review",
    detectedAt: "12m ago (06:22 IST)",
    samplesObserved: 860,
    presenceShift: {
      baseline: "amount: 100% (INR ₹)",
      current: "amount: 100% (paise)",
    },
    magnitudeShift: {
      baseline: "typical: 499 (rupees)",
      current: "typical: 49,900 (paise, 100× bigger)",
    },
    baselinePayload: {
      id: "pay_982b1c4e",
      amount: 499,
      currency: "INR",
      status: "captured",
    },
    observedPayload: {
      id: "pay_982b1c4e",
      amount: 49900,
      currency: "INR",
      status: "captured",
    },
    codeSites: [
      {
        file: "services/checkout.ts",
        line: 67,
        usageKind: "money + arithmetic",
        snippet: "const totalCharge = payment.amount;",
        workflow: "Order Payment Authorization",
      },
      {
        file: "services/ledger.ts",
        line: 122,
        usageKind: "money + persistence",
        snippet: "await db.insert('ledger').values({ amount: payment.amount });",
        workflow: "Refund & Accounting Ledger",
      },
    ],
    detectorReasoning:
      "'amount' became exactly 100 times bigger in every response we looked at, and the currency is still INR. That means the unit changed from rupees to paise.",
    aiExplanation:
      "The payment provider changed denominations from rupees to paise. Because this field holds money, Seismo never fixes it automatically: a person has to review it.",
    aiModelBadge: "NVIDIA NIM · Nemotron-3 Ultra (550B)",
    safetyLadderRung: "Rung 2: Transform (Review Only)",
    aliasRule: {
      endpoint: "/payments",
      source: "amount / 100",
      target: "amount",
    },
    checks: [
      { id: "C1", label: "The field 'amount' is in the responses", passed: true },
      { id: "C2", label: "Fixing it needs maths on the value, not just a rename", passed: true },
      { id: "C3", label: "Money field: no automatic fix", passed: true },
      { id: "C4", label: "Sent to the review queue for a person", passed: true },
    ],
  },
};
