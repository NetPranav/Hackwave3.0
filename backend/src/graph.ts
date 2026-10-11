import { DirectedGraph } from 'graphology';
import type { CodeMap, Graph as GraphDto, DriftState } from '@seismo/contracts';

type Node = GraphDto['nodes'][number];
type Link = GraphDto['links'][number];

const WORST: DriftState[] = ['breaking', 'fix_pending', 'suspected', 'normal'];
const worse = (a: DriftState, b: DriftState) => (WORST.indexOf(a) <= WORST.indexOf(b) ? a : b);

export interface GraphInput {
  maps: CodeMap[];
  /** drift state per node id (service / endpoint / field), supplied by the drift engine (P4). */
  states?: Record<string, DriftState>;
  callsPerMin?: Record<string, number>;
}

/**
 * Code map(s) -> dependency graph: service -> endpoint -> field <- code location -> workflow.
 * Node ids are stable across status, graph, drift and radar so the views link to each other.
 */
export const ids = {
  service: (s: string) => `svc:${s}`,
  endpoint: (s: string, e: string, m?: string) => `ep:${s}:${m ? m + ' ' : ''}${e}`,
  field: (s: string, e: string, f: string) => `f:${s}:${e}:${f}`,
  code: (file: string, line: number) => `code:${file}:${line}`,
  workflow: (w: string) => `wf:${w}`,
};

export function buildGraph({ maps, states = {}, callsPerMin = {} }: GraphInput): { dto: GraphDto; g: DirectedGraph } {
  const g = new DirectedGraph();
  const addNode = (n: Node) => { if (!g.hasNode(n.id)) g.addNode(n.id, n); };
  const addLink = (l: Link) => { if (!g.hasEdge(l.source, l.target)) g.addEdge(l.source, l.target, l); };

  for (const map of maps) {
    const byId = new Map(map.callSites.map((c) => [c.id, c]));
    for (const wf of map.workflows) addNode({ id: ids.workflow(wf.id), type: 'workflow', label: wf.name, state: 'normal' });

    for (const cs of map.callSites) {
      if (cs.unresolved) continue;
      const svc = ids.service(cs.service), ep = ids.endpoint(cs.service, cs.endpoint, cs.method);
      addNode({ id: svc, type: 'service', label: cs.service, state: states[svc] ?? 'normal', size: 20 });
      addNode({ id: ep, type: 'endpoint', label: `${cs.method} ${cs.endpoint}`, state: states[ep] ?? 'normal', service: cs.service, size: Math.max(6, Math.min(16, 6 + (callsPerMin[ep] ?? 0) / 10)) });
      addLink({ source: svc, target: ep, kind: 'has' });
      const code = ids.code(cs.file, cs.line);
      addNode({ id: code, type: 'code', label: `${cs.file}:${cs.line}`, state: 'normal', service: cs.service });
      for (const wf of map.workflows) if (matches(wf.globs, cs.file)) addLink({ source: code, target: ids.workflow(wf.id), kind: 'in' });
    }

    for (const r of map.fieldReads) {
      const cs = byId.get(r.callSiteId);
      if (!cs || cs.unresolved) continue;
      const f = ids.field(cs.service, cs.endpoint, r.field);
      const reads = (g.hasNode(f) ? (g.getNodeAttribute(f, 'size') as number) : 3) + 1;
      if (!g.hasNode(f)) addNode({ id: f, type: 'field', label: r.field, state: states[f] ?? 'normal', service: cs.service, size: 3 });
      g.setNodeAttribute(f, 'size', Math.min(reads, 12));
      addLink({ source: ids.endpoint(cs.service, cs.endpoint, cs.method), target: f, kind: 'has' });
      addNode({ id: ids.code(r.file, r.line), type: 'code', label: `${r.file}:${r.line}`, state: 'normal', service: cs.service });
      addLink({ source: ids.code(r.file, r.line), target: f, kind: 'reads' });
      // a read in a file of a workflow connects the field's path to that workflow
      for (const wf of map.workflows) if (matches(wf.globs, r.file)) addLink({ source: ids.code(r.file, r.line), target: ids.workflow(wf.id), kind: 'in' });
    }
  }

  // Propagate the worst state of a field/endpoint up to its service, and down to the code reading it.
  g.forEachNode((id, a) => {
    if (a.type === 'field' || a.type === 'endpoint') {
      const st = states[id] ?? 'normal';
      if (st !== 'normal') {
        g.forEachInNeighbor(id, (nb) => { const cur = g.getNodeAttribute(nb, 'state') as DriftState; g.setNodeAttribute(nb, 'state', worse(cur, st)); });
      }
    }
  });
  g.forEachNode((id, a) => {
    if (a.type === 'endpoint') g.forEachInNeighbor(id, (svc) => { const st = a.state as DriftState; g.setNodeAttribute(svc, 'state', worse(g.getNodeAttribute(svc, 'state') as DriftState, st)); });
  });

  const dto: GraphDto = { nodes: g.mapNodes((_, a) => a as Node), links: g.mapEdges((_, a) => a as Link) };
  return { dto, g };
}

/** Everything on the path between a node and the workflows it can hurt (and the service above it). */
export function impact(g: DirectedGraph, nodeId: string): GraphDto {
  if (!g.hasNode(nodeId)) return { nodes: [], links: [] };
  const keep = new Set<string>([nodeId]);
  const walk = (start: string, dir: 'in' | 'out') => {
    const stack = [start];
    while (stack.length) {
      const cur = stack.pop()!;
      const next = dir === 'in' ? g.inNeighbors(cur) : g.outNeighbors(cur);
      for (const n of next) if (!keep.has(n)) { keep.add(n); stack.push(n); }
    }
  };
  walk(nodeId, 'in');   // endpoint, service, code that reads it
  const code = [...keep].filter((id) => g.getNodeAttribute(id, 'type') === 'code');
  for (const c of code) for (const w of g.outNeighbors(c)) if (g.getNodeAttribute(w, 'type') === 'workflow') keep.add(w);
  return {
    nodes: [...keep].map((id) => g.getNodeAttributes(id) as Node),
    links: g.edges().filter((e) => keep.has(g.source(e)) && keep.has(g.target(e))).map((e) => g.getEdgeAttributes(e) as Link),
  };
}

export function coverage(maps: CodeMap[], seenEndpoints = 0, seenFields = 0) {
  const calls = maps.flatMap((m) => m.callSites);
  const resolved = calls.filter((c) => !c.unresolved);
  const fields = new Set(maps.flatMap((m) => m.fieldReads.map((r) => `${r.callSiteId}|${r.field}`)));
  const endpoints = new Set(resolved.map((c) => `${c.service}|${c.method}|${c.endpoint}`));
  return {
    endpointsMapped: endpoints.size, endpointsSeen: Math.max(seenEndpoints, endpoints.size),
    fieldsMapped: fields.size, fieldsSeen: Math.max(seenFields, fields.size),
    unresolvedCalls: calls.length - resolved.length,
  };
}

function matches(globs: string[], file: string) {
  return globs.some((g) => globToRegex(g).test(file));
}
function globToRegex(g: string) {
  const re = g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '@@').replace(/\*/g, '[^/]*').replace(/@@/g, '.*');
  return new RegExp('^' + re + '$');
}
