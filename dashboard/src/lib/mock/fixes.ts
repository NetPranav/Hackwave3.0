// Mock fix rules, shaped like the alias-spec / fix-request contracts (P5). Replace with the real API later.

export type FixStatus = "pr_open" | "ci_green" | "merged" | "safety_blocked";

export interface CheckItem {
  id: "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7" | "C8";
  name: string;
  sourceOfTruth: string;
  passed: boolean;
  evidence: string;
}

export interface FixRuleData {
  id: string;
  ruleId: string;
  service: string;
  serviceSlug: string;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  sourceField: string;
  targetField: string;
  path: string;
  status: FixStatus;
  safetyLadderRung: "Rung 1: Additive Alias (Auto-Safe)" | "Rung 2: Transform (Review Only)" | "Rung 3: Behaviour Change";
  driftId: string;
  driftType: string;
  branchName: string;
  fixPrNumber?: number;
  prUrl?: string;
  detectedAt: string;
  impactWorkflows: string[];
  codeSites: {
    file: string;
    line: number;
    workflow: string;
    snippet: string;
  }[];
  checks: CheckItem[];
  diffBefore: string;
  diffAfter: string;
  syntheticV2Payload: Record<string, unknown>;
  syntheticRuntimeOutput: Record<string, unknown>;
  testAssertion: {
    beforeFix: string;
    afterFix: string;
  };
}

export const FIX_RULES: FixRuleData[] = [
  {
    id: "fix_users_name_104",
    ruleId: "a104",
    service: "Users API",
    serviceSlug: "users",
    endpoint: "/users/{id}",
    method: "GET",
    sourceField: "display_name",
    targetField: "name",
    path: "$",
    status: "ci_green",
    safetyLadderRung: "Rung 1: Additive Alias (Auto-Safe)",
    driftId: "drf_users_name_rename",
    driftType: "Field rename",
    branchName: "seismo/alias-users-name",
    fixPrNumber: 104,
    prUrl: "https://github.com/NetPranav/seismo-demo-shop/pull/104",
    detectedAt: "4m ago (06:30 IST)",
    impactWorkflows: ["Invoice PDF Generation", "Customer Profile Rendering", "Checkout Settlement"],
    codeSites: [
      {
        file: "services/invoice.ts",
        line: 108,
        workflow: "Invoice PDF Generation",
        snippet: "doc.text(`Billed to: ${user.name}`, 20, 40);",
      },
      {
        file: "lib/api/users.ts",
        line: 42,
        workflow: "Customer Profile Rendering",
        snippet: "const username = response.data.name;",
      },
      {
        file: "components/checkout/AddressSummary.tsx",
        line: 29,
        workflow: "Checkout Settlement",
        snippet: "<span>Recipient: {recipient.name}</span>",
      },
    ],
    checks: [
      {
        id: "C1",
        name: "Identifier-Safe & Denylist Check",
        sourceOfTruth: "Regex Whitelist (G3)",
        passed: true,
        evidence: "Both 'name' and 'display_name' match ^[A-Za-z_][A-Za-z0-9_]{0,63}$. Zero prototype keys.",
      },
      {
        id: "C2",
        name: "Target Missing in ≥ 99% Responses",
        sourceOfTruth: "Baseline Windows",
        passed: true,
        evidence: "'name' is absent in 100.0% of recent 1,420 samples at path '$'. Only adding what is missing.",
      },
      {
        id: "C3",
        name: "Dominant Type & Format Class Match",
        sourceOfTruth: "Baseline Telemetry",
        passed: true,
        evidence: "Both fields are string / text. String length p50 matches (14 chars baseline vs 14 chars observed).",
      },
      {
        id: "C4",
        name: "Value Similarity Evidence (D3)",
        sourceOfTruth: "Detector D3 Overlap",
        passed: true,
        evidence: "Name token distribution overlap is 0.94 (threshold: 0.75). Value similarity verified.",
      },
      {
        id: "C5",
        name: "AST Code Map Conflict Check",
        sourceOfTruth: "AST Scanner + aliases.json",
        passed: true,
        evidence: "No other code reads 'display_name' with a different meaning; zero duplicate alias collision.",
      },
      {
        id: "C6",
        name: "Unambiguous Candidate Check",
        sourceOfTruth: "Detector Ranking",
        passed: true,
        evidence: "Confidence 0.96 (next candidate: none, margin +0.96 ≥ 0.15). No tie-break needed.",
      },
      {
        id: "C7",
        name: "Property Tests Pass (G1–G4)",
        sourceOfTruth: "seismo/aliases.test.ts",
        passed: true,
        evidence: "10,000 runs of fast-check verified G1 (identity), G2 (containment), G3 (safety), and G4 (no-throw).",
      },
      {
        id: "C8",
        name: "Customer Repository CI Green",
        sourceOfTruth: "GitHub Checks API",
        passed: true,
        evidence: "Shop test suite passes with alias rule applied: 6 passed, 0 failed in 24 seconds.",
      },
    ],
    diffBefore: `[\n  // Existing active alias rules\n]`,
    diffAfter: `[\n  {\n    "id": "a104",\n    "kind": "alias",\n    "endpoint": "GET /users/{id}",\n    "path": "$",\n    "target": "name",\n    "source": "display_name",\n    "driftEvent": "drf_users_name_rename",\n    "addedAt": "2026-10-18T06:30:00Z"\n  }\n]`,
    syntheticV2Payload: {
      id: "usr_91b72e0a",
      display_name: "Aarav Sharma",
      email: "aarav.sharma@example.com",
      role: "admin",
    },
    syntheticRuntimeOutput: {
      id: "usr_91b72e0a",
      display_name: "Aarav Sharma",
      name: "Aarav Sharma",
      email: "aarav.sharma@example.com",
      role: "admin",
    },
    testAssertion: {
      beforeFix: "FAIL: user.name is undefined (Billed to: undefined)",
      afterFix: "PASS: user.name is 'Aarav Sharma' (Billed to: Aarav Sharma)",
    },
  },
  {
    id: "fix_payments_amount_paise",
    ruleId: "a106_blocked",
    service: "Payments Gateway",
    serviceSlug: "payments",
    endpoint: "/payments",
    method: "POST",
    sourceField: "amount",
    targetField: "amount",
    path: "$",
    status: "safety_blocked",
    safetyLadderRung: "Rung 2: Transform (Review Only)",
    driftId: "drf_payments_amount_paise",
    driftType: "Unit change (paise)",
    branchName: "— (Auto-PR Prohibited)",
    detectedAt: "12m ago (06:22 IST)",
    impactWorkflows: ["Order Payment Authorization", "Refund & Accounting Ledger"],
    codeSites: [
      {
        file: "services/checkout.ts",
        line: 67,
        workflow: "Order Payment Authorization",
        snippet: "const totalCharge = payment.amount;",
      },
      {
        file: "services/ledger.ts",
        line: 122,
        workflow: "Refund & Accounting Ledger",
        snippet: "await db.insert('ledger').values({ amount: payment.amount });",
      },
    ],
    checks: [
      {
        id: "C1",
        name: "Identifier-Safe & Denylist Check",
        sourceOfTruth: "Regex Whitelist",
        passed: true,
        evidence: "Field name 'amount' is valid identifier.",
      },
      {
        id: "C2",
        name: "Target Missing in ≥ 99% Responses",
        sourceOfTruth: "Baseline Windows",
        passed: false,
        evidence: "Target field 'amount' is NOT missing; it is present but scaled by 100 (Rupees → Paise).",
      },
      {
        id: "C3",
        name: "Dominant Type & Format Class Match",
        sourceOfTruth: "Baseline Telemetry",
        passed: false,
        evidence: "Magnitude shift: P50 changed from 499 to 49,900. Mathematical transform required (÷ 100).",
      },
      {
        id: "C4",
        name: "Value Similarity Evidence (D5)",
        sourceOfTruth: "Detector D5",
        passed: true,
        evidence: "Exact factor-of-100 multiplication detected.",
      },
      {
        id: "C5",
        name: "AST Code Map Conflict Check",
        sourceOfTruth: "AST Scanner",
        passed: true,
        evidence: "Used in financial calculation.",
      },
      {
        id: "C6",
        name: "Safety Ladder Rule 5 Enforcement",
        sourceOfTruth: "Product Rule §5",
        passed: false,
        evidence: "MONEY SAFETY GUARD: Monetary and branching fields NEVER receive automated PRs.",
      },
      {
        id: "C7",
        name: "Property Tests Pass",
        sourceOfTruth: "seismo/aliases.test.ts",
        passed: true,
        evidence: "Transforms require human review under Rung 2.",
      },
      {
        id: "C8",
        name: "Routed to Human Review Queue",
        sourceOfTruth: "Safety Policy",
        passed: true,
        evidence: "Diverted to /app/review with deterministic template suggestion.",
      },
    ],
    diffBefore: `[]`,
    diffAfter: `// Automated PR blocked by Safety Ladder Rule 5.\n// Routed to Human Review Queue: /app/review`,
    syntheticV2Payload: {
      id: "pay_982b1c4e",
      amount: 49900,
      currency: "INR",
      status: "captured",
    },
    syntheticRuntimeOutput: {
      id: "pay_982b1c4e",
      amount: 49900,
      currency: "INR",
      status: "captured",
    },
    testAssertion: {
      beforeFix: "WARNING: Charged ₹49,900 instead of ₹499",
      afterFix: "Needs a person: the suggested conversion (amount ÷ 100) is waiting for approval",
    },
  },
  {
    id: "fix_users_id_merged",
    ruleId: "a101",
    service: "Users API",
    serviceSlug: "users",
    endpoint: "/users/{id}",
    method: "GET",
    sourceField: "user_id",
    targetField: "id",
    path: "$",
    status: "merged",
    safetyLadderRung: "Rung 1: Additive Alias (Auto-Safe)",
    driftId: "drf_users_id_rename",
    driftType: "Field rename",
    branchName: "seismo/alias-user-id",
    fixPrNumber: 98,
    prUrl: "https://github.com/NetPranav/seismo-demo-shop/pull/98",
    detectedAt: "Yesterday (14:10 IST)",
    impactWorkflows: ["User Directory Lookups"],
    codeSites: [
      {
        file: "services/users.ts",
        line: 14,
        workflow: "User Directory Lookups",
        snippet: "const recordId = user.id;",
      },
    ],
    checks: [
      { id: "C1", name: "Identifier-Safe Check", sourceOfTruth: "G3 Regex", passed: true, evidence: "Valid identifier." },
      { id: "C2", name: "Target Missing ≥ 99%", sourceOfTruth: "Baseline", passed: true, evidence: "'id' was missing in v2." },
      { id: "C3", name: "Type & Format Match", sourceOfTruth: "Baseline", passed: true, evidence: "UUID / String." },
      { id: "C4", name: "Similarity Evidence", sourceOfTruth: "D3", passed: true, evidence: "100% hash overlap." },
      { id: "C5", name: "No AST Conflict", sourceOfTruth: "Code Map", passed: true, evidence: "No naming conflict." },
      { id: "C6", name: "Unambiguous Candidate", sourceOfTruth: "Detector", passed: true, evidence: "Unambiguous." },
      { id: "C7", name: "Property Tests Green", sourceOfTruth: "CI", passed: true, evidence: "10,000 runs passed." },
      { id: "C8", name: "Repo CI Green", sourceOfTruth: "GitHub", passed: true, evidence: "Merged and active." },
    ],
    diffBefore: `[]`,
    diffAfter: `[\n  {\n    "id": "a101",\n    "kind": "alias",\n    "endpoint": "GET /users/{id}",\n    "path": "$",\n    "target": "id",\n    "source": "user_id",\n    "driftEvent": "drf_users_id_rename",\n    "addedAt": "2026-10-17T14:10:00Z"\n  }\n]`,
    syntheticV2Payload: { user_id: "cst_4891b", email: "client@test.com" },
    syntheticRuntimeOutput: { user_id: "cst_4891b", id: "cst_4891b", email: "client@test.com" },
    testAssertion: {
      beforeFix: "FIXED: the fix is live",
      afterFix: "PASS: user.id works again thanks to the fix",
    },
  },
];
