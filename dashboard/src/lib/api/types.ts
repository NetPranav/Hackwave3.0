// Types of the Seismo backend API, mirrored by hand from the zod contracts in ../contracts/src (drift.ts, status.ts,
// graph.ts, common.ts). The dashboard has its own lockfile and deploys alone, so it cannot import @seismo/contracts.
// Keep in sync with contracts/generated/openapi.json when a contract changes.

export type Severity = "info" | "warning" | "breaking";
export type DriftState = "normal" | "suspected" | "breaking" | "fix_pending" | "resolved" | "expected" | "snoozed";

export interface Me {
  login: string;
  name?: string;
  avatarUrl?: string;
  installations: string[];
  appSlug?: string;
  installUrl?: string;
}

export interface Overview {
  servicesMonitored: number;
  endpoints: number;
  coveragePct: number;
  openDrifts: { info: number; warning: number; breaking: number };
  fixPrsOpen: number;
  radarUpcoming: number;
}

export interface EndpointStatusApi {
  endpoint: string;
  method: string;
  state: DriftState;
  callsPerMin: number;
  errorRate: number;
  p95Ms: number;
  rate429: number;
  fieldsMapped: number;
}

export interface ServiceStatusApi {
  service: string;
  state: DriftState;
  provider: "operational" | "degraded" | "outage" | "unknown";
  callsPerMin: number;
  errorRate: number;
  p95Ms: number;
  lastSeen: string;
  upcomingChange?: string;
  sparkline: number[];
  endpoints: EndpointStatusApi[];
}

export interface GraphNodeApi {
  id: string;
  type: "service" | "endpoint" | "field" | "code" | "workflow";
  label: string;
  state: DriftState;
  size?: number;
  service?: string;
  deprecationDate?: string;
  unused?: boolean;
}
export interface GraphApi {
  nodes: GraphNodeApi[];
  links: { source: string; target: string; kind: "has" | "reads" | "in" | "feeds" }[];
}

export interface Installation {
  id: string;
  account: string;
  repos: { name: string; scan: "pending" | "running" | "done" | "failed"; progress: number }[];
}

export interface Coverage {
  endpointsMapped: number;
  endpointsSeen: number;
  fieldsMapped: number;
  fieldsSeen: number;
  unresolvedCalls?: number;
}

export interface AliasRule {
  id?: string;
  kind: "alias";
  endpoint: string;
  path: string;
  target: string;
  source: string;
  driftEvent?: string;
  addedAt?: string;
}
export interface ScaleRule {
  id?: string;
  kind: "scale";
  endpoint: string;
  path: string;
  field: string;
  divideBy: number;
  driftEvent?: string;
  addedAt?: string;
}
export interface CoerceRule {
  id?: string;
  kind: "coerce";
  endpoint: string;
  path: string;
  field: string;
  to: "number" | "string";
  driftEvent?: string;
  addedAt?: string;
}
export interface MapRule {
  id?: string;
  kind: "map";
  endpoint: string;
  path: string;
  field: string;
  map: Record<string, string | number | boolean>;
  driftEvent?: string;
  addedAt?: string;
}
export type SeismoRule = AliasRule | ScaleRule | CoerceRule | MapRule;

export interface CheckResult {
  id: "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7" | "C8" | "C9";
  passed: boolean;
  detail?: string;
}

export interface AiExplanation {
  title: string;
  summary: string;
  impact: string;
  recommendation: string;
  risk: "low" | "medium" | "high";
  confidence: number;
  model: string;
  latencyMs: number;
  source: "ai" | "template";
  judgement?: { choice: string; confidence: number; reason: string };
}

export interface Usage {
  file: string;
  line: number;
  kind: string;
  url?: string;
  repo?: string;
  snippet?: string;
  workflows?: string[];
}

export interface DriftEvent {
  id: string;
  service: string;
  endpoint: string;
  field?: string;
  detector: string;
  title: string;
  severity: Severity;
  state: DriftState;
  confidence: number;
  detectedAt: string;
  before: unknown;
  after: unknown;
  usages: Usage[];
  explanation?: AiExplanation;
  fix?: {
    rung: "alias" | "transform" | "behaviour";
    rule?: SeismoRule;
    validation?: { driftId: string; checks: CheckResult[]; ci: "pending" | "green" | "red"; prUrl?: string };
  };
  /** v3-P2: the rename rule is served live to the SDK (auto-heal on) and how many responses it has healed */
  heal?: { live: boolean; hits: number; lastAt?: string };
}

export interface ReviewItemApi {
  id: string;
  drift: DriftEvent;
  suggestion: string;
  reason?: string;
  /** v2: the data rule the fix template proposes (a human opens the PR, after the stress test) */
  proposedRule?: SeismoRule;
  status: "open" | "expected" | "snoozed" | "pr_opened";
}

export type Channel = "dashboard" | "github" | "whatsapp" | "slack" | "discord" | "email";
export interface NotificationApi {
  id: string;
  driftId: string;
  channel: Channel;
  title: string;
  sentAt: string;
  ok: boolean;
  error?: string;
  read: boolean;
}

interface Threshold {
  minSeverity?: Severity;
}
export interface NotificationSettings {
  whatsapp: { enabled: boolean; to?: string } & Threshold;
  slack: { enabled: boolean; webhookUrl?: string } & Threshold;
  discord: { enabled: boolean; webhookUrl?: string } & Threshold;
  email: { enabled: boolean; to?: string } & Threshold;
  github: { enabled: boolean } & Threshold;
  minSeverity: Severity;
  aiEnabled: boolean;
  /** v3-P2: serve checked rename rules to the SDK at once, before the PR is merged */
  autoHeal?: boolean;
}

export interface RadarItemApi {
  id: string;
  service: string;
  title: string;
  kind: "deprecation" | "sunset" | "changelog" | "breaking" | "spec";
  changeType: string;
  date?: string;
  source: string;
  sourceUrl?: string;
  quote?: string;
  endpoint?: string;
  field?: string;
  matchedFiles: string[];
  severity: Severity;
  suggestion: string;
  extractedBy: "ai" | "rules" | "header" | "spec";
  driftEventId?: string;
  detectedAt?: string;
}

export interface FieldProfile {
  type: string;
  format?: string;
  presence: number;
  nullRate: number;
  magnitude?: number;
  lengthP50?: number;
  enumValues?: string[];
  arrayMax?: number;
}

export interface CompareApi {
  service: string;
  endpoint: string;
  v1: unknown;
  v2: unknown;
  fields?: { path: string; before?: FieldProfile; after?: FieldProfile }[];
  samples?: { before: number; after: number };
  diff: { path: string; change: "added" | "removed" | "type" | "magnitude" | "enum" | "length"; before?: unknown; after?: unknown }[];
}

export type SimulateScenario =
  | { kind: "rename"; field: string; to: string }
  | { kind: "remove"; field: string }
  | { kind: "type"; field: string; to: "string" | "number" | "boolean" | "null" }
  | { kind: "units"; field: string; factor: number }
  | { kind: "enum"; field: string; value: string }
  | { kind: "limit"; field: string; max: number };

export interface SimulateResultApi {
  detector: string;
  affected: Usage[];
  severity: Severity;
  fixRung: "alias" | "transform" | "behaviour";
  workflows: string[];
  explanation: string;
}

export interface SdkKeyInfo {
  id: string;
  createdAt: string;
  revoked: boolean;
}
