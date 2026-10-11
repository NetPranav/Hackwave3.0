// What to say about a node, from the same mocks as the rest of the dashboard. Used by the hover card and the side panel.

import { sitesFor, type CodeSite } from "@/lib/mock/codemap";
import { FIX_RULES } from "@/lib/mock/fixes";
import { SERVICES_STATUS_DATA, type EndpointStatus, type FieldComparison } from "@/lib/mock/status";
import { TIMELINE_EVENTS, type TimelineDriftEvent } from "@/lib/mock/timeline";
import { plainType, plainUsage } from "@/lib/plain";
import { STATE_LABEL, type BuiltGraph, type GraphNode } from "./types";

export interface NodeInfo {
  kind: string;
  title: string;
  subtitle?: string;
  rows: [string, string][];
  sites: CodeSite[];
  events: { id: string; title: string }[];
  rules: { text: string; prNumber?: number }[];
  related: string[];
  links: { label: string; href: string }[];
  snippet?: string;
}

const drifts = TIMELINE_EVENTS.filter((i): i is TimelineDriftEvent => i.type !== "deploy");
const num = (n: number) => n.toLocaleString("en-US");

function findEndpoint(id?: string): { ep: EndpointStatus; slug: string } | null {
  for (const svc of SERVICES_STATUS_DATA) {
    const ep = svc.endpoints.find((e) => e.id === id);
    if (ep) return { ep, slug: svc.slug };
  }
  return null;
}

/** The what-if that matches how this field changed, so "Simulate" opens ready to run. */
function simulateLink(ep: EndpointStatus, field: FieldComparison): string {
  const base = "/app/compare?mode=simulate&endpoint=" + ep.id + "&field=" + encodeURIComponent(field.path);
  switch (field.status) {
    case "unit_drift":
      return base + "&change=scale&value=100";
    case "enum_expanded":
      return base + "&change=enum&value=" + encodeURIComponent((field.enumValues ?? []).find((v) => v.startsWith("+"))?.slice(1) ?? "new_value");
    case "limit_capped":
      return base + "&change=cap&value=100";
    default: {
      const renamed = ep.fields.find((f) => f.status === "new_field")?.path;
      return base + "&change=rename" + (renamed ? "&value=" + encodeURIComponent(renamed) : "");
    }
  }
}

function empty(kind: string, title: string): NodeInfo {
  return { kind, title, rows: [], sites: [], events: [], rules: [], related: [], links: [] };
}

function describeService(node: GraphNode): NodeInfo {
  const svc = SERVICES_STATUS_DATA.find((s) => s.slug === node.ref.serviceSlug);
  const info = empty("Service", node.label);
  if (!svc) return info;
  info.subtitle = svc.host;
  info.rows = [
    ["State", STATE_LABEL[node.state]],
    ["Traffic", num(svc.callsPerMin) + " req/min"],
    ["Response time", svc.p95LatencyMs + " ms"],
    ["Errors", svc.errorRatePercent.toFixed(2) + "%"],
    ["Provider", svc.providerStatus],
  ];
  info.events = drifts.filter((e) => e.serviceSlug === svc.slug && e.severity !== "info").map((e) => ({ id: e.id, title: e.title }));
  info.links = [{ label: "Open status", href: "/app/status/" + svc.slug }];
  return info;
}

function describeEndpoint(node: GraphNode): NodeInfo {
  const found = findEndpoint(node.ref.endpointId);
  const info = empty("API call", node.label);
  if (!found) return info;
  const { ep } = found;
  info.rows = [
    ["State", STATE_LABEL[node.state]],
    ["Traffic", num(ep.callsPerMin) + " req/min"],
    ["Response time", ep.p95LatencyMs + " ms"],
    ["Errors", ep.errorRatePercent + "%"],
    ["Rate-limited", String(ep.rateLimits429)],
  ];
  info.links = [
    { label: "Compare before vs now", href: "/app/compare?endpoint=" + ep.id },
    { label: "Open status", href: "/app/status/" + found.slug },
  ];
  return info;
}

function describeField(node: GraphNode): NodeInfo {
  const found = findEndpoint(node.ref.endpointId);
  const field = found?.ep.fields.find((f) => f.path === node.ref.field);
  const info = empty("Field", node.label);
  if (!found || !field) return info;

  info.subtitle = found.ep.method + " " + found.ep.path;
  info.rows = [
    ["State", STATE_LABEL[node.state]],
    ["Type", field.baselineType === field.observedType ? plainType(field.observedType) : plainType(field.baselineType) + " → " + plainType(field.observedType)],
    ["Seen in", field.baselinePresence === field.observedPresence ? field.observedPresence : field.baselinePresence + " → " + field.observedPresence],
    ["Typical size", field.p50Magnitude],
    ["Used in code", String(node.weight)],
  ];
  info.sites = node.weight > 0 ? sitesFor(found.slug, field.path) : [];
  if (field.status !== "match") {
    info.events = drifts.filter((e) => e.serviceSlug === found.slug && e.severity !== "info").map((e) => ({ id: e.id, title: e.title }));
  }
  info.rules = FIX_RULES.filter(
    (r) => r.serviceSlug === found.slug && r.endpoint === found.ep.path && (r.targetField === field.path || r.sourceField === field.path)
  ).map((r) => ({ text: "Rule " + r.ruleId + ": " + r.targetField + " ← " + r.sourceField, prNumber: r.fixPrNumber }));
  info.links = [{ label: "Simulate a change here", href: simulateLink(found.ep, field) }];
  return info;
}

function describeCode(node: GraphNode): NodeInfo {
  const site = sitesFor(node.ref.serviceSlug, node.ref.field ?? "").find((s) => s.file === node.ref.file && s.line === node.ref.line);
  const info = empty("Code spot", node.label);
  if (!site) return info;
  info.subtitle = site.file + ":" + site.line;
  info.rows = [
    ["State", STATE_LABEL[node.state]],
    ["Used for", plainUsage(site.usageKind)],
    ["Workflow", site.workflow],
  ];
  info.snippet = site.snippet;
  info.links = [{ label: "View on GitHub", href: "https://github.com/NetPranav/seismo-demo-shop/blob/main/" + site.file + "#L" + site.line }];
  return info;
}

function describeWorkflow(node: GraphNode, graph: BuiltGraph): NodeInfo {
  const info = empty("Feature", node.label);
  const labelOf = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;
  const codes = graph.inn.get(node.id) ?? [];
  info.rows = [
    ["State", STATE_LABEL[node.state]],
    ["Code spots", String(codes.length)],
  ];
  info.related = codes.map(labelOf);
  return info;
}

export function describeNode(node: GraphNode, graph: BuiltGraph): NodeInfo {
  switch (node.type) {
    case "service":
      return describeService(node);
    case "endpoint":
      return describeEndpoint(node);
    case "field":
      return describeField(node);
    case "code":
      return describeCode(node);
    case "workflow":
      return describeWorkflow(node, graph);
  }
}
