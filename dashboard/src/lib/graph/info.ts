// What to say about a node, from the same mocks as the rest of the dashboard. Used by the hover card and the side panel.

import type { CodeSite } from "@/lib/mock/codemap";
import type { EndpointStatus, FieldComparison } from "@/lib/mock/status";
import type { TimelineDriftEvent } from "@/lib/mock/timeline";
import { plainType, plainUsage } from "@/lib/plain";
import { STATE_LABEL, type BuiltGraph, type GraphData, type GraphNode } from "./types";

export interface NodeInfo {
  kind: string;
  title: string;
  subtitle?: string;
  rows: [string, string][];
  sites: (CodeSite & { url?: string })[];
  events: { id: string; title: string }[];
  rules: { text: string; prNumber?: number }[];
  related: string[];
  links: { label: string; href: string }[];
  snippet?: string;
}

const driftsOf = (d: GraphData) => d.timeline.filter((i): i is TimelineDriftEvent => i.type === "drift" && i.state !== "resolved");
const num = (n: number) => n.toLocaleString("en-US");

function findEndpoint(d: GraphData, id?: string): { ep: EndpointStatus; slug: string } | null {
  for (const svc of d.services) {
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

function describeService(node: GraphNode, d: GraphData): NodeInfo {
  const svc = d.services.find((s) => s.slug === node.ref.serviceSlug);
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
  info.events = driftsOf(d).filter((e) => e.serviceSlug === svc.slug && e.severity !== "info").map((e) => ({ id: e.id, title: e.title }));
  info.links = [{ label: "Open status", href: "/app/status/" + svc.slug }];
  return info;
}

function describeEndpoint(node: GraphNode, d: GraphData): NodeInfo {
  const found = findEndpoint(d, node.ref.endpointId);
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

function describeField(node: GraphNode, d: GraphData): NodeInfo {
  const found = findEndpoint(d, node.ref.endpointId);
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
  // link to the line in the repo Seismo scanned (from the code map, not a fixed repo)
  info.sites = node.weight > 0 ? d.sitesFor(found.slug, field.path).map((s) => ({ ...s, url: d.codeUrl(s.file, s.line) })) : [];
  if (field.status !== "match") {
    info.events = driftsOf(d).filter((e) => e.serviceSlug === found.slug && e.severity !== "info").map((e) => ({ id: e.id, title: e.title }));
  }
  info.rules = d.fixes.filter(
    (r) => r.serviceSlug === found.slug && r.endpoint === found.ep.path && (r.targetField === field.path || r.sourceField === field.path)
  ).map((r) => ({ text: "Rule " + r.ruleId + ": " + r.targetField + " ← " + r.sourceField, prNumber: r.fixPrNumber }));
  info.links = [{ label: "Simulate a change here", href: simulateLink(found.ep, field) }];
  return info;
}

function describeCode(node: GraphNode, d: GraphData): NodeInfo {
  const site = d.sitesFor(node.ref.serviceSlug, node.ref.field ?? "").find((s) => s.file === node.ref.file && s.line === node.ref.line);
  const info = empty("Code spot", node.label);
  if (!site) return info;
  info.subtitle = site.file + ":" + site.line;
  info.rows = [
    ["State", STATE_LABEL[node.state]],
    ["Used for", plainUsage(site.usageKind)],
    ["Workflow", site.workflow],
  ];
  info.snippet = site.snippet;
  const url = d.codeUrl(site.file, site.line);
  info.links = url ? [{ label: "View on GitHub", href: url }] : [];
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
      return describeService(node, graph.data);
    case "endpoint":
      return describeEndpoint(node, graph.data);
    case "field":
      return describeField(node, graph.data);
    case "code":
      return describeCode(node, graph.data);
    case "workflow":
      return describeWorkflow(node, graph);
  }
}
