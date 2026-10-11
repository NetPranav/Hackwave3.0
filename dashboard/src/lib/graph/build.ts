// Builds the dependency graph from the shared mocks: service → endpoint → field → code → workflow.
// A change on a field turns its whole downstream path the same colour.

import { UNRESOLVED_READS, sitesFor } from "@/lib/mock/codemap";
import { SERVICES_STATUS_DATA } from "@/lib/mock/status";
import { TIMELINE_EVENTS, type TimelineDriftEvent } from "@/lib/mock/timeline";
import {
  STATE_RANK,
  type BuiltGraph,
  type GraphLink,
  type GraphNode,
  type GraphNodeType,
  type GraphState,
} from "./types";

const drifts = TIMELINE_EVENTS.filter((i): i is TimelineDriftEvent => i.type !== "deploy");

function serviceState(slug: string): GraphState {
  const events = drifts
    .filter((e) => e.serviceSlug === slug && e.severity !== "info")
    .sort((a, b) => (a.severity === "breaking" ? 0 : 1) - (b.severity === "breaking" ? 0 : 1));
  const event = events[0];
  if (!event) return "normal";
  return event.state === "fix_pending" ? "fix" : event.severity === "breaking" ? "breaking" : "suspected";
}

export function buildGraph(): BuiltGraph {
  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  const add = (node: Omit<GraphNode, "unused"> & { unused?: boolean }) => {
    const existing = nodes.get(node.id);
    if (existing) {
      if (STATE_RANK[node.state] < STATE_RANK[existing.state]) existing.state = node.state;
      return existing;
    }
    const full: GraphNode = { unused: false, ...node };
    nodes.set(full.id, full);
    return full;
  };
  const link = (source: string, target: string, state: GraphState) => links.push({ source, target, state });

  for (const svc of SERVICES_STATUS_DATA) {
    const state = serviceState(svc.slug);
    const serviceId = "svc:" + svc.slug;
    add({ id: serviceId, type: "service", label: svc.name, state, cluster: svc.slug, weight: svc.callsPerMin, ref: { serviceSlug: svc.slug } });

    const claimed = new Set<string>();
    for (const ep of svc.endpoints) {
      const hasChange = ep.fields.some((f) => f.status !== "match");
      const epState: GraphState = hasChange ? state : "normal";
      const epId = "ep:" + ep.id;
      add({ id: epId, type: "endpoint", label: ep.method + " " + ep.path, state: epState, cluster: svc.slug, weight: ep.callsPerMin, ref: { serviceSlug: svc.slug, endpointId: ep.id } });
      link(serviceId, epId, epState);

      for (const f of ep.fields) {
        const changed = f.status !== "match";
        const sites = claimed.has(f.path) ? [] : sitesFor(svc.slug, f.path);
        const fieldState: GraphState = changed ? state : "normal";
        const fieldId = "fd:" + ep.id + ":" + f.path;
        add({
          id: fieldId,
          type: "field",
          label: f.path,
          state: fieldState,
          cluster: svc.slug,
          weight: sites.length,
          unused: !changed && sites.length === 0,
          ref: { serviceSlug: svc.slug, endpointId: ep.id, field: f.path },
        });
        link(epId, fieldId, fieldState);

        if (sites.length) claimed.add(f.path);
        for (const site of sites) {
          const codeId = "code:" + site.file + ":" + site.line;
          const name = site.file.split("/").pop() ?? site.file;
          add({ id: codeId, type: "code", label: name + ":" + site.line, state: fieldState, cluster: svc.slug, weight: 1, ref: { serviceSlug: svc.slug, endpointId: ep.id, field: f.path, file: site.file, line: site.line } });
          link(fieldId, codeId, fieldState);
          const wfId = "wf:" + site.workflow;
          add({ id: wfId, type: "workflow", label: site.workflow, state: fieldState, cluster: svc.slug, weight: 1, ref: { serviceSlug: svc.slug } });
          link(codeId, wfId, fieldState);
        }
      }
    }
  }

  const out = new Map<string, string[]>();
  const inn = new Map<string, string[]>();
  for (const l of links) {
    out.set(l.source, [...(out.get(l.source) ?? []), l.target]);
    inn.set(l.target, [...(inn.get(l.target) ?? []), l.source]);
  }

  const list = [...nodes.values()];
  const count = (type: GraphNodeType) => list.filter((n) => n.type === type).length;

  return {
    nodes: list,
    links,
    out,
    inn,
    meta: {
      mappedReads: count("code"),
      unresolvedReads: UNRESOLVED_READS.length,
      counts: { service: count("service"), endpoint: count("endpoint"), field: count("field"), code: count("code"), workflow: count("workflow") },
    },
  };
}

/** Everything upstream and downstream of a node: the full path a change travels. */
export function pathOf(id: string, graph: Pick<BuiltGraph, "out" | "inn">): Set<string> {
  const seen = new Set<string>([id]);
  const walk = (start: string, edges: Map<string, string[]>) => {
    const stack = [start];
    while (stack.length) {
      const current = stack.pop() as string;
      for (const next of edges.get(current) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
  };
  walk(id, graph.out);
  walk(id, graph.inn);
  return seen;
}
