// v2-P3: real API responses -> the view models the screens were designed with (src/lib/mock/* types).
// Pure functions, no fetching. Rule: never invent data. When the engine has no value for a field the screen shows
// "—" (or leaves a list empty) instead of a made-up number.

import type { CodeSite, DriftDetailData } from "@/lib/mock/drift";
import type { CheckItem, FixRuleData, FixStatus } from "@/lib/mock/fixes";
import type { ReviewItem, ReviewReason } from "@/lib/mock/review";
import type { DriftState as ViewState, EndpointStatus, FieldComparison, ProviderHealth, ServiceStatusItem } from "@/lib/mock/status";
import type { EventSeverity, EventState, TimelineDeployMarker, TimelineDriftEvent, TimelineItem } from "@/lib/mock/timeline";
import type { ChartDay } from "@/lib/mock/overview";
import type { RadarItem } from "@/lib/mock/radar";
import type {
  CheckResult,
  CompareApi,
  DriftEvent,
  RadarItemApi,
  ReviewItemApi,
  ServiceStatusApi,
  Usage,
} from "./types";

// ---------------------------------------------------------------------------------------------------------------
// Code map (GET /v1/codemap)

export interface CodeMapView {
  repos: { repo: string; commit: string; scannedAt: string }[];
  callSites: { id: string; repo: string; file: string; line: number; service: string; method: string; endpoint: string; unresolved?: boolean; workflows: string[] }[];
  fieldReads: { callSiteId: string; field: string; file: string; line: number; usage: string; money: boolean; snippet?: string; repo: string; workflows: string[] }[];
  workflows: { id: string; name: string; file: string; repo: string }[];
}

export const EMPTY_CODEMAP: CodeMapView = { repos: [], callSites: [], fieldReads: [], workflows: [] };

/** Code reads of `field` (or anything under it) on any endpoint of `service`. */
export function sitesFromCodemap(cm: CodeMapView, service: string, field: string): CodeSite[] {
  const sites = new Map(cm.callSites.filter((c) => c.service === service && !c.unresolved).map((c) => [c.id, c]));
  return cm.fieldReads
    .filter((r) => sites.has(r.callSiteId) && (r.field === field || r.field.startsWith(field + ".") || r.field.startsWith(field + "[]")))
    .map((r) => ({ file: r.file, line: r.line, usageKind: r.money ? r.usage + "+money" : r.usage, snippet: r.snippet ?? "", workflow: r.workflows[0] ?? "" }));
}

export function unresolvedFromCodemap(cm: CodeMapView) {
  return cm.callSites.filter((c) => c.unresolved).map((c) => ({ file: c.file, line: c.line, reason: "Service or endpoint could not be determined statically" }));
}

// ---------------------------------------------------------------------------------------------------------------
// Small helpers

const titleCase = (s: string) => s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const serviceName = (service: string) => titleCase(service) + " API";

export function relative(iso: string, now: number): string {
  if (!now) return "—"; // before the first client tick
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.round(s / 60) + "m ago";
  if (s < 86400) return Math.round(s / 3600) + "h ago";
  return Math.round(s / 86400) + "d ago";
}

type Method = "GET" | "POST" | "PUT" | "DELETE";
const asMethod = (m: string): Method => (["GET", "POST", "PUT", "DELETE"].includes(m.toUpperCase()) ? (m.toUpperCase() as Method) : "GET");

/** "GET /users/{id}" -> ["GET", "/users/{id}"] */
export function splitEndpoint(endpoint: string): [Method, string] {
  const [m, ...rest] = endpoint.split(" ");
  return rest.length ? [asMethod(m), rest.join(" ")] : ["GET", endpoint];
}

export const endpointId = (service: string, method: string, path: string) =>
  ("ep_" + service + "_" + method + "_" + path).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/_+$/, "");

const OPEN = (e: DriftEvent) => !["resolved", "expected", "snoozed", "normal"].includes(e.state);

export const DETECTOR_NAME: Record<string, string> = {
  D1: "Field removed",
  D2: "New field",
  D3: "Field renamed",
  D4: "Type changed",
  D5: "Unit change",
  D6: "Value distribution shift",
  D7: "New enum value",
  D8: "Enum value vanished",
  D9: "Silent truncation (limit)",
  D10: "Pagination changed",
  D11: "Error shape changed",
  D12: "Rate limit changed",
  D13: "Deprecation / Sunset",
  D14: "Empty success",
  D16: "Conflicting fields",
  D17: "Endpoint gone",
};
export const detectorName = (d: string) => DETECTOR_NAME[d] ?? d;

export const CHECK_NAME: Record<CheckResult["id"], { name: string; source: string }> = {
  C1: { name: "Identifier-safe names, not on the denylist", source: "Rule (G3)" },
  C2: { name: "Target missing in at least 99% of responses", source: "Baseline windows" },
  C3: { name: "Same type and format class as before", source: "Baseline" },
  C4: { name: "Value similarity supports the rename", source: "Detector D3 evidence" },
  C5: { name: "No conflicting read or rule", source: "Code map + aliases.json" },
  C6: { name: "One clear rename candidate", source: "Detector (+ AI judge)" },
  C7: { name: "Property tests for this rule pass", source: "seismo/aliases.test.ts in your CI" },
  C8: { name: "Your repo's CI is green", source: "GitHub checks" },
};

const prNumber = (url?: string) => {
  const m = url ? /\/pull\/(\d+)/.exec(url) : null;
  return m ? Number(m[1]) : undefined;
};

const ev = (x: unknown) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {});
const pct = (n: unknown) => (typeof n === "number" ? Math.round(n * 100) + "%" : "—");

/** One short "before → after" pair for lists, from the detector's evidence (statistics only). */
export function shortDiff(e: DriftEvent): { before: string; after: string } | undefined {
  const b = ev(e.before);
  const a = ev(e.after);
  switch (e.detector) {
    case "D3":
      return { before: String(b.field ?? e.field ?? "?"), after: String(a.field ?? "?") };
    case "D1":
      return { before: (e.field ?? "field") + " " + pct(b.presence), after: pct(a.presence) };
    case "D4":
      return { before: String(b.type ?? "?"), after: String(a.type ?? "?") };
    case "D5":
    case "D6":
      return { before: "p50 " + (b.p50 ?? "?"), after: "p50 " + (a.p50 ?? "?") };
    case "D7": {
      const added = Array.isArray(a.added) ? (a.added as { value: string }[]).map((x) => x.value) : [];
      return { before: (Array.isArray(b.values) ? b.values.length : "?") + " values", after: "+" + (added.join(", ") || "?") };
    }
    case "D9":
      return { before: "asked " + (a.limitAsked ?? b.limitAsked ?? "?"), after: "got " + (a.maxLength ?? "?") };
    case "D12":
      return { before: String(b.limit ?? pct(b.rate429)), after: String(a.limit ?? pct(a.rate429)) };
    case "D13":
      return { before: "—", after: String(a.sunset ?? a.deprecation ?? "deprecated") };
    default:
      return undefined;
  }
}

const workflowsOf = (usages: Usage[]) => [...new Set(usages.flatMap((u) => u.workflows ?? []))];

function viewSeverity(e: DriftEvent): EventSeverity {
  if (e.state === "resolved") return "resolved";
  return e.severity === "breaking" ? "breaking" : e.severity === "warning" ? "suspected" : "info";
}
function viewEventState(e: DriftEvent, inReview: boolean): EventState {
  if (e.state === "resolved" || e.state === "expected" || e.state === "snoozed") return "resolved";
  if (e.state === "fix_pending") return "fix_pending";
  return inReview ? "under_review" : "confirmed";
}

// ---------------------------------------------------------------------------------------------------------------
// Timeline

export function toTimeline(events: DriftEvent[], reviewIds: Set<string>, radar: RadarItemApi[], cm: CodeMapView, now = Date.now()): TimelineItem[] {
  const drifts: TimelineDriftEvent[] = events.map((e) => {
    const [method, path] = splitEndpoint(e.endpoint);
    const pr = prNumber(e.fix?.validation?.prUrl);
    return {
      id: e.id,
      type: "drift",
      service: serviceName(e.service),
      serviceSlug: e.service,
      endpoint: path,
      method,
      field: e.field ?? "—",
      detectorId: e.detector,
      detectorName: detectorName(e.detector),
      title: e.title,
      description: e.explanation?.summary ?? e.title,
      timestamp: e.detectedAt,
      relativeTime: relative(e.detectedAt, now),
      severity: viewSeverity(e),
      state: viewEventState(e, reviewIds.has(e.id)),
      confidence: Math.round(e.confidence * 100),
      impactedWorkflows: workflowsOf(e.usages),
      impactedFilesCount: new Set(e.usages.map((u) => u.file)).size,
      ...(pr ? { fixPrNumber: pr } : {}),
      ...(e.fix ? { fixType: e.fix.rung === "alias" ? ("alias" as const) : ("review" as const) } : {}),
      ...(shortDiff(e) ? { diffSnippet: shortDiff(e) } : {}),
    };
  });
  const announced: TimelineDriftEvent[] = radar
    .filter((r) => !r.driftEventId)
    .map((r) => {
      const [method, path] = splitEndpoint(r.endpoint ?? "");
      const at = r.detectedAt ?? (r.date ? r.date + "T00:00:00.000Z" : new Date(now).toISOString());
      return {
        id: r.id,
        type: "radar",
        service: serviceName(r.service),
        serviceSlug: r.service,
        endpoint: path || "—",
        method,
        field: r.field ?? "—",
        detectorId: "RADAR",
        detectorName: "Announced (" + r.source + ")",
        title: r.title,
        description: r.quote ?? r.suggestion,
        timestamp: at,
        relativeTime: relative(at, now),
        severity: r.severity === "breaking" ? "breaking" : r.severity === "warning" ? "suspected" : "info",
        state: "confirmed",
        confidence: 80,
        impactedWorkflows: [],
        impactedFilesCount: new Set(r.matchedFiles.map((f) => f.split(":")[0])).size,
      };
    });
  const scans: TimelineDeployMarker[] = cm.repos.map((r) => ({
    id: "scan-" + r.repo + "-" + r.commit,
    type: "deploy",
    commitHash: r.commit.slice(0, 7),
    commitMessage: "Code map scanned: " + r.repo,
    author: "Seismo",
    timestamp: r.scannedAt,
    relativeTime: relative(r.scannedAt, now),
  }));
  return [...drifts, ...announced, ...scans].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

// ---------------------------------------------------------------------------------------------------------------
// API Status

function typeLabel(p?: { type: string; format?: string }) {
  if (!p) return "— (absent)";
  return p.format && p.format !== "text" ? p.type + " (" + p.format + ")" : p.type;
}
function magLabel(p?: { magnitude?: number; lengthP50?: number; arrayMax?: number }) {
  if (!p) return "—";
  if (p.magnitude !== undefined) return "~10^" + p.magnitude;
  if (p.lengthP50 !== undefined) return "length " + p.lengthP50;
  if (p.arrayMax !== undefined) return "max " + p.arrayMax + " items";
  return "—";
}

/** Field rows of one endpoint: statistics from /v1/compare, status from the open drift events. */
export function toFieldRows(cmp: CompareApi | undefined, events: DriftEvent[]): FieldComparison[] {
  if (!cmp?.fields) return [];
  const statusOf = (path: string, before: unknown, after: unknown): { status: FieldComparison["status"]; note?: string } => {
    for (const e of events) {
      const a = ev(e.after);
      if (e.detector === "D3" && e.field === path) return { status: "missing_renamed", note: "Renamed to " + String(a.field ?? "?") + ": code that reads '" + path + "' gets nothing" };
      if (e.detector === "D3" && a.field === path) return { status: "new_field", note: "New name of '" + (e.field ?? "?") + "'" };
      if (e.field !== path) continue;
      if (e.detector === "D1") return { status: "removed", note: "Gone from responses" };
      if (e.detector === "D2") return { status: "new_field" };
      if (e.detector === "D4") return { status: "type_changed", note: e.title };
      if (e.detector === "D5" || e.detector === "D6") return { status: "unit_drift", note: e.title };
      if (e.detector === "D7" || e.detector === "D8") return { status: "enum_expanded", note: e.title };
      if (e.detector === "D9") return { status: "limit_capped", note: e.title };
    }
    // without a detector event, only call a field gone/new when it was (or now is) in almost every response
    const b = before as { presence?: number } | undefined;
    const a = after as { presence?: number } | undefined;
    if (b && !a && (b.presence ?? 0) >= 0.95) return { status: "removed" };
    if (!b && a && (a.presence ?? 0) >= 0.95) return { status: "new_field" };
    return { status: "match" };
  };
  return cmp.fields.map((f) => {
    const { status, note } = statusOf(f.path, f.before, f.after);
    const added = (f.after?.enumValues ?? []).filter((v) => !(f.before?.enumValues ?? []).includes(v));
    const values = f.before?.enumValues || f.after?.enumValues ? [...(f.before?.enumValues ?? []), ...added.map((v) => "+" + v)] : undefined;
    return {
      path: f.path,
      baselineType: typeLabel(f.before),
      observedType: f.after ? typeLabel(f.after) : cmp.samples?.after ? "— (absent)" : typeLabel(f.before),
      baselinePresence: f.before ? pct(f.before.presence) : "0%",
      observedPresence: f.after ? pct(f.after.presence) : cmp.samples?.after ? "0%" : pct(f.before?.presence),
      p50Magnitude: magLabel(f.after ?? f.before),
      ...(values ? { enumValues: values } : {}),
      status,
      ...(note ? { note } : {}),
    };
  });
}

/** Fields the code reads on this endpoint but that no traffic has shown yet: listed so the graph and status show them. */
function withMappedFields(rows: FieldComparison[], cm: CodeMapView, service: string, method: string, path: string): FieldComparison[] {
  const ids = new Set(cm.callSites.filter((c) => c.service === service && c.method.toUpperCase() === method.toUpperCase() && c.endpoint === path).map((c) => c.id));
  const read = [...new Set(cm.fieldReads.filter((r) => ids.has(r.callSiteId)).map((r) => r.field.split(".")[0].replace(/\[\]$/, "")))];
  const have = new Set(rows.map((r) => r.path));
  const extra = read.filter((f) => !have.has(f)).map((f): FieldComparison => ({ path: f, baselineType: "— (no traffic yet)", observedType: "— (no traffic yet)", baselinePresence: "—", observedPresence: "—", p50Magnitude: "—", status: "match", note: "Read by your code; no traffic seen yet" }));
  return [...rows, ...extra];
}

function viewState(events: DriftEvent[], reviewIds: Set<string>): ViewState {
  const open = events.filter((e) => OPEN(e) && e.severity !== "info");
  if (!open.length) return "normal";
  if (open.some((e) => e.state === "fix_pending")) return "fix_pending";
  if (open.some((e) => reviewIds.has(e.id))) return "under_review";
  return "changed";
}

const PROVIDER: Record<ServiceStatusApi["provider"], { health: ProviderHealth; label: string }> = {
  operational: { health: "operational", label: "Operational" },
  degraded: { health: "degraded", label: "Degraded" },
  outage: { health: "outage", label: "Outage" },
  unknown: { health: "operational", label: "Not reported" },
};

export function toServices(
  status: ServiceStatusApi[],
  events: DriftEvent[],
  reviewIds: Set<string>,
  cm: CodeMapView,
  compares: Record<string, CompareApi>,
  now = Date.now()
): ServiceStatusItem[] {
  const mapped = cm.callSites.filter((c) => !c.unresolved);
  const names = new Set([...status.map((s) => s.service), ...events.filter(OPEN).map((e) => e.service), ...mapped.map((c) => c.service)]);
  return [...names].map((service) => {
    const s = status.find((x) => x.service === service);
    const svcEvents = events.filter((e) => e.service === service);
    const eps = new Map<string, { method: string; path: string; api?: ServiceStatusApi["endpoints"][number] }>();
    for (const ep of s?.endpoints ?? []) eps.set(ep.method + " " + ep.endpoint, { method: ep.method, path: ep.endpoint, api: ep });
    for (const e of svcEvents.filter(OPEN)) if (!eps.has(e.endpoint)) { const [m, p] = splitEndpoint(e.endpoint); eps.set(e.endpoint, { method: m, path: p }); }
    // endpoints the code calls but that have sent no traffic yet (from the code map)
    for (const c of mapped.filter((x) => x.service === service)) { const k = c.method.toUpperCase() + " " + c.endpoint; if (!eps.has(k)) eps.set(k, { method: c.method.toUpperCase(), path: c.endpoint }); }

    const endpoints: EndpointStatus[] = [...eps].map(([key, { method, path, api }]) => {
      const epEvents = svcEvents.filter((e) => e.endpoint === key && OPEN(e));
      return {
        id: endpointId(service, method, path),
        method: asMethod(method),
        path,
        callsPerMin: Math.round(api?.callsPerMin ?? 0),
        errorRatePercent: Math.round((api?.errorRate ?? 0) * 10000) / 100,
        p95LatencyMs: Math.round(api?.p95Ms ?? 0),
        rateLimits429: Math.round((api?.rate429 ?? 0) * (api?.callsPerMin ?? 0)),
        lastSeen: s ? relative(s.lastSeen, now) : "no traffic",
        state: viewState(epEvents, reviewIds),
        fields: withMappedFields(toFieldRows(compares[service + "|" + key], epEvents), cm, service, method, path),
      };
    });
    const state = viewState(svcEvents, reviewIds);
    const worst = svcEvents.filter((e) => OPEN(e) && e.severity !== "info").sort((a, b) => (a.severity === "breaking" ? 0 : 1) - (b.severity === "breaking" ? 0 : 1))[0];
    const max = Math.max(1, ...(s?.sparkline ?? [0]));
    const mappedFields = new Set(cm.fieldReads.filter((r) => cm.callSites.some((c) => c.id === r.callSiteId && c.service === service)).map((r) => r.field));
    const provider = PROVIDER[s?.provider ?? "unknown"];
    return {
      id: "svc_" + service,
      slug: service,
      name: serviceName(service),
      provider: titleCase(service),
      host: endpoints.length + " endpoint" + (endpoints.length === 1 ? "" : "s") + " seen",
      endpointsCount: endpoints.length,
      fieldsMapped: mappedFields.size,
      state,
      stateLabel: state === "fix_pending" ? "FIX READY" : state === "under_review" ? "REVIEW" : state === "changed" ? "CHANGED" : "NORMAL",
      stateDescription: worst?.title ?? "No change detected",
      callsPerMin: Math.round(s?.callsPerMin ?? 0),
      sparkline: (s?.sparkline ?? []).map((v) => Math.round((v / max) * 100)),
      errorRatePercent: Math.round((s?.errorRate ?? 0) * 10000) / 100,
      p95LatencyMs: Math.round(s?.p95Ms ?? 0),
      rateLimits429: endpoints.reduce((n, e) => n + e.rateLimits429, 0),
      providerStatus: provider.health,
      providerStatusLabel: provider.label,
      providerStatusUrl: "",
      deprecationNotice: s?.upcomingChange ?? null,
      lastSeen: s ? relative(s.lastSeen, now) : "no traffic",
      graphNodeId: "service-" + service,
      endpoints,
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Drift detail, fixes, review

export function toCodeSites(usages: Usage[]): CodeSite[] {
  return usages.map((u) => ({ file: u.file, line: u.line, usageKind: u.kind, snippet: u.snippet ?? "", workflow: (u.workflows ?? [])[0] ?? "" }));
}

function toChecks(checks: CheckResult[] | undefined): { id: string; label: string; passed: boolean }[] {
  return (checks ?? []).map((c) => ({ id: c.id, label: CHECK_NAME[c.id].name + (c.detail ? " · " + c.detail : ""), passed: c.passed }));
}

function rungLabel(e: DriftEvent): DriftDetailData["safetyLadderRung"] {
  if (e.fix?.rung === "alias") return "Rung 1: Additive Alias";
  if (e.fix?.rung === "transform" || e.detector === "D5" || e.detector === "D4") return "Rung 2: Transform (Review Only)";
  return "Rung 3: Behaviour Change";
}

function reasoning(e: DriftEvent): string {
  const b = ev(e.before);
  const a = ev(e.after);
  const parts = [`${detectorName(e.detector)} (${e.detector}) at ${Math.round(e.confidence * 100)}% confidence.`];
  const d = shortDiff(e);
  if (d) parts.push(`Before: ${d.before}. Now: ${d.after}.`);
  if (typeof b.presence === "number" || typeof a.presence === "number") parts.push(`Presence ${pct(b.presence)} → ${pct(a.presence)}.`);
  parts.push("Detection is deterministic: it compares statistics of recent responses with the baseline, never raw values.");
  return parts.join(" ");
}

export function toDriftDetail(e: DriftEvent, cmp: CompareApi | undefined, reviewIds: Set<string>): DriftDetailData {
  const [method, path] = splitEndpoint(e.endpoint);
  const b = ev(e.before);
  const a = ev(e.after);
  const rule = e.fix?.rule;
  const newName = rule?.kind === "alias" ? rule.source : typeof a.field === "string" ? a.field : undefined;
  const st = viewEventState(e, reviewIds.has(e.id));
  return {
    id: e.id,
    service: serviceName(e.service),
    serviceSlug: e.service,
    endpoint: path,
    method,
    field: e.field ? (e.detector === "D3" && newName ? e.field + " → " + newName : e.field) : "—",
    detectorId: e.detector,
    detectorName: detectorName(e.detector),
    confidence: Math.round(e.confidence * 100),
    severity: e.severity === "breaking" ? "breaking" : e.severity === "warning" ? "suspected" : "info",
    state: st === "under_review" ? "under_review" : st === "fix_pending" ? "fix_pending" : st === "resolved" ? "resolved" : "confirmed",
    detectedAt: e.detectedAt,
    samplesObserved: cmp?.samples?.after ?? 0,
    presenceShift: { baseline: pct(b.presence), current: pct(a.presence) },
    ...(e.detector === "D5" || e.detector === "D6" ? { magnitudeShift: { baseline: "p50 " + String(b.p50 ?? "?"), current: "p50 " + String(a.p50 ?? "?") } } : {}),
    baselinePayload: (cmp?.v1 && typeof cmp.v1 === "object" ? cmp.v1 : {}) as Record<string, unknown>,
    observedPayload: (cmp?.v2 && typeof cmp.v2 === "object" ? cmp.v2 : {}) as Record<string, unknown>,
    codeSites: toCodeSites(e.usages),
    detectorReasoning: reasoning(e),
    aiExplanation: e.explanation ? [e.explanation.summary, e.explanation.impact, e.explanation.recommendation].filter(Boolean).join(" ") : "Explanation pending.",
    aiModelBadge: e.explanation ? (e.explanation.source === "ai" ? e.explanation.model : "template") : "template",
    safetyLadderRung: rungLabel(e),
    aliasRule: {
      endpoint: e.endpoint,
      source: rule?.kind === "alias" ? rule.source : newName ?? "",
      target: rule?.kind === "alias" ? rule.target : e.field ?? "",
    },
    checks: toChecks(e.fix?.validation?.checks),
    ...(prNumber(e.fix?.validation?.prUrl) ? { fixPrNumber: prNumber(e.fix?.validation?.prUrl) } : {}),
  };
}

function fixStatus(e: DriftEvent): FixStatus {
  const v = e.fix?.validation;
  if (e.state === "resolved") return "merged";
  if (v?.checks.some((c) => !c.passed) || v?.ci === "red") return "safety_blocked";
  if (v?.ci === "green") return "ci_green";
  return "pr_open";
}

export function toFixes(events: DriftEvent[]): FixRuleData[] {
  return events
    .filter((e) => e.fix?.rule && e.fix.rule.kind === "alias")
    .map((e) => {
      const rule = e.fix!.rule!;
      const alias = rule.kind === "alias" ? rule : undefined;
      const [method, path] = splitEndpoint(e.endpoint);
      const checks: CheckItem[] = (e.fix?.validation?.checks ?? []).map((c) => ({
        id: c.id,
        name: CHECK_NAME[c.id].name,
        sourceOfTruth: CHECK_NAME[c.id].source,
        passed: c.passed,
        evidence: c.detail ?? (c.passed ? "Passed" : "Failed"),
      }));
      const ruleJson = JSON.stringify({ kind: "alias", endpoint: rule.endpoint, path: rule.path, target: alias?.target, source: alias?.source }, null, 2);
      return {
        id: "fix_" + e.id,
        ruleId: rule.id ?? e.id,
        service: serviceName(e.service),
        serviceSlug: e.service,
        endpoint: path,
        method,
        sourceField: alias?.source ?? "",
        targetField: alias?.target ?? "",
        path: rule.path,
        status: fixStatus(e),
        safetyLadderRung: "Rung 1: Additive Alias (Auto-Safe)",
        driftId: e.id,
        driftType: detectorName(e.detector) + " (" + e.detector + ")",
        branchName: "seismo/alias-" + (rule.id ?? e.id),
        ...(prNumber(e.fix?.validation?.prUrl) ? { fixPrNumber: prNumber(e.fix?.validation?.prUrl), prUrl: e.fix?.validation?.prUrl } : {}),
        detectedAt: e.detectedAt,
        impactWorkflows: workflowsOf(e.usages),
        codeSites: toCodeSites(e.usages).map((s) => ({ file: s.file, line: s.line, workflow: s.workflow, snippet: s.snippet })),
        checks,
        diffBefore: '{\n  "version": 1,\n  "rules": []\n}',
        diffAfter: '{\n  "version": 1,\n  "rules": [\n' + ruleJson.replace(/^/gm, "    ") + "\n  ]\n}",
        syntheticV2Payload: alias ? { [alias.source]: "<" + alias.target + " value>" } : {},
        syntheticRuntimeOutput: alias ? { [alias.source]: "<" + alias.target + " value>", [alias.target]: "<" + alias.target + " value>" } : {},
        testAssertion: {
          beforeFix: alias ? `expect(applyAliases(v2Response).${alias.target}).toBeUndefined()  // without the rule` : "",
          afterFix: alias ? `expect(applyAliases(v2Response, rules).${alias.target}).toBe(v2Response.${alias.source})` : "",
        },
      };
    });
}

function reviewReason(item: ReviewItemApi): ReviewReason {
  const kinds = item.drift.usages.map((u) => u.kind).join(" ");
  const r = (item.reason ?? "").toLowerCase();
  if (/money/.test(kinds) || /money|unit/.test(r)) return "money";
  if (/persist/.test(kinds) || /persist|saved/.test(r)) return "persistence";
  return "branching";
}

export function toReview(items: ReviewItemApi[]): ReviewItem[] {
  return items
    .filter((i) => i.status === "open")
    .map((i) => {
      const e = i.drift;
      const [method, path] = splitEndpoint(e.endpoint);
      const d = shortDiff(e);
      const rule = e.fix?.rule;
      return {
        id: i.id,
        driftId: e.id,
        service: serviceName(e.service),
        method,
        endpoint: path,
        detectorId: e.detector,
        detectorName: detectorName(e.detector),
        reason: reviewReason(i),
        title: e.title,
        detectedAt: e.detectedAt,
        confidence: Math.round(e.confidence * 100),
        before: d?.before ?? "—",
        after: d?.after ?? "—",
        aiExplanation: e.explanation?.source === "ai" ? e.explanation.summary + " " + e.explanation.recommendation : "",
        aiModel: e.explanation?.source === "ai" ? e.explanation.model : "template",
        aiLatencyMs: e.explanation?.latencyMs ?? 0,
        templateExplanation: i.suggestion,
        suggestion: {
          kind: rule?.kind === "scale" ? "transform" : e.fix?.rung === "alias" ? "alias" : "behaviour",
          summary: i.suggestion,
          rule: rule ? JSON.stringify(rule, null, 2) : "",
          note: i.reason ?? "Needs a human decision.",
        },
        impactedWorkflows: workflowsOf(e.usages),
      };
    });
}

// ---------------------------------------------------------------------------------------------------------------
// Overview chart (GET /v1/metrics)

export interface MetricsDay {
  date: string;
  buckets: { start: string; calls: number | null; p95Ms: number | null; drifts: number | null }[];
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const niceMax = (n: number) => {
  if (n <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(n));
  return Math.ceil(n / p) * p;
};
const short = (n: number) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(Math.round(n)));

export function toChart(days: MetricsDay[], events: DriftEvent[]) {
  const chartDays: ChartDay[] = days.map((d) => {
    const [, m, day] = d.date.split("-");
    return {
      date: MONTHS[Number(m) - 1] + " " + day,
      volume: d.buckets.map((b) => (b.calls === null ? null : Math.round((b.calls / 360) * 10) / 10)),
      latency: d.buckets.map((b) => b.p95Ms),
      drifts: d.buckets.map((b) => b.drifts),
      driftNotes: d.buckets.map((b) => {
        if (!b.drifts) return null;
        const from = Date.parse(b.start);
        const names = [...new Set(events.filter((e) => e.severity !== "info" && Date.parse(e.detectedAt) >= from && Date.parse(e.detectedAt) < from + 6 * 3600_000).map((e) => titleCase(e.service)))];
        return names.join(", ") || null;
      }),
    };
  });
  const maxOf = (k: "volume" | "latency" | "drifts") => niceMax(Math.max(0, ...chartDays.flatMap((d) => d[k].filter((x): x is number => x !== null))));
  const max = { volume: maxOf("volume"), latency: maxOf("latency"), drifts: maxOf("drifts") };
  const ticks = (m: number, unit = "") => [m, (m * 3) / 4, m / 2, m / 4, 0].map((v) => short(v) + unit);
  return { days: chartDays, max, ticks: { volume: ticks(max.volume), latency: ticks(max.latency, "ms"), drifts: ticks(max.drifts) } };
}

// ---------------------------------------------------------------------------------------------------------------
// Radar (GET /v1/radar) -> Adarsh's radar page model

const SIM: Partial<Record<string, "rename" | "scale" | "enum" | "cap">> = { rename: "rename", units: "scale", enum: "enum", limit: "cap" };

export function toRadar(items: RadarItemApi[]): RadarItem[] {
  return items.map((r) => {
    const [method, path] = splitEndpoint(r.endpoint ?? "");
    const change = SIM[r.changeType];
    return {
      id: r.id,
      service: serviceName(r.service),
      serviceSlug: r.service,
      title: r.title,
      kind: r.kind,
      changeType: r.changeType as RadarItem["changeType"],
      ...(r.date ? { date: r.date.slice(0, 10) } : {}),
      source: r.source,
      ...(r.sourceUrl ? { sourceUrl: r.sourceUrl } : {}),
      ...(r.quote ? { quote: r.quote } : {}),
      ...(r.endpoint ? { endpoint: r.endpoint } : {}),
      ...(r.field ? { field: r.field } : {}),
      matchedFiles: r.matchedFiles,
      severity: r.severity,
      suggestion: r.suggestion,
      extractedBy: r.extractedBy,
      ...(r.driftEventId ? { driftEventId: r.driftEventId } : {}),
      explanation: r.suggestion || r.title,
      aiModel: r.extractedBy === "ai" ? "AI extraction (quote verified)" : r.extractedBy,
      ...(change && r.endpoint && r.field ? { simulation: { endpoint: endpointId(r.service, method, path), change, field: r.field, value: "" } } : {}),
    };
  });
}
