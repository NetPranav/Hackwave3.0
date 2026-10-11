// Flow layout: five columns (API → API call → field → your code → feature). Every link is a ribbon whose thickness is
// how much flows through it, so a busy API visibly carries more than a quiet one. Written for this graph, not general.

import type { BuiltGraph, GraphNode, GraphNodeType, GraphState } from "./types";

export const COLUMNS: GraphNodeType[] = ["service", "endpoint", "field", "code", "workflow"];

export const COLUMN_TITLE: Record<GraphNodeType, string> = {
  service: "API",
  endpoint: "API call",
  field: "Field",
  code: "Your code",
  workflow: "Feature",
};

export const MIN_R = 5;
export const MAX_R = 14;
const LEFT = 100;
const RIGHT = 160;
const TOP = 132;
const BOTTOM = 96;

export interface FlowNode {
  node: GraphNode;
  col: number;
  x: number;
  y: number;
  /** Height of the slot it occupies (twice the radius). */
  h: number;
  /** Radius: bigger means more significant (traffic, reads in code, features reached, and whether it changed). */
  r: number;
  value: number;
}

export interface FlowLink {
  id: string;
  source: string;
  target: string;
  state: GraphState;
  /** Path of the ribbon's centre line, always the same shape so it can be animated between layouts. */
  d: string;
}

export interface FlowLayout {
  nodes: Map<string, FlowNode>;
  links: FlowLink[];
  columnX: number[];
  columnCount: number[];
}

interface Edge {
  source: string;
  target: string;
  state: GraphState;
  value: number;
}

/** Where every visible node goes and how thick each ribbon is. */
export function layoutFlow(graph: BuiltGraph, visible: Set<string>, width: number, height: number): FlowLayout {
  const colOf = (type: GraphNodeType) => COLUMNS.indexOf(type);
  const nodes = graph.nodes.filter((n) => visible.has(n.id));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Ribbons. A call carries as much as the fields under it; everything else carries one.
  const fieldsUnder = new Map<string, number>();
  for (const l of graph.links) {
    if (byId.get(l.source)?.type === "endpoint" && byId.get(l.target)?.type === "field") {
      fieldsUnder.set(l.source, (fieldsUnder.get(l.source) ?? 0) + 1);
    }
  }
  const edges: Edge[] = graph.links
    .filter((l) => byId.has(l.source) && byId.has(l.target))
    .map((l) => ({
      source: l.source,
      target: l.target,
      state: l.state,
      value: byId.get(l.source)?.type === "service" ? Math.max(fieldsUnder.get(l.target) ?? 1, 1) : 1,
    }));

  const inEdges = new Map<string, Edge[]>();
  const outEdges = new Map<string, Edge[]>();
  for (const e of edges) {
    inEdges.set(e.target, [...(inEdges.get(e.target) ?? []), e]);
    outEdges.set(e.source, [...(outEdges.get(e.source) ?? []), e]);
  }
  const sum = (list: Edge[] | undefined) => (list ?? []).reduce((a, e) => a + e.value, 0);

  const columns: FlowNode[][] = COLUMNS.map(() => []);
  const flow = new Map<string, FlowNode>();
  for (const n of nodes) {
    const col = colOf(n.type);
    const item: FlowNode = { node: n, col, x: 0, y: 0, h: 0, r: MIN_R, value: Math.max(sum(inEdges.get(n.id)), sum(outEdges.get(n.id)), 1) };
    columns[col].push(item);
    flow.set(n.id, item);
  }

  // Significance decides the size: traffic for APIs and calls, reads in code for fields, features reached; changed things grow.
  const significance = (n: GraphNode): number => {
    const base =
      n.type === "service" || n.type === "endpoint"
        ? Math.max(n.weight, 1)
        : n.type === "field"
          ? 1 + n.weight
          : n.type === "workflow"
            ? Math.max(inEdges.get(n.id)?.length ?? 1, 1)
            : 1;
    return base * (n.state === "normal" ? 1 : 1.6);
  };
  for (const column of columns) {
    const top = Math.max(...column.map((n) => significance(n.node)), 1);
    for (const n of column) n.r = MIN_R + (MAX_R - MIN_R) * Math.sqrt(significance(n.node) / top);
  }

  const areaH = Math.max(height - TOP - BOTTOM, 160);
  const widest = Math.max(...columns.map((c) => c.reduce((a, n) => a + n.r * 2, 0)), 1);
  const tallest = Math.max(...columns.map((c) => c.length), 2);
  const gap = Math.min(Math.max(((areaH - widest) / (tallest - 1)) * 0.92, 26), 40);

  const span = Math.max(width - LEFT - RIGHT, 600);
  const columnX = COLUMNS.map((_, i) => LEFT + MAX_R + (span / (COLUMNS.length - 1)) * i);

  for (const column of columns) for (const n of column) {
    n.h = n.r * 2;
    n.x = columnX[n.col];
  }

  // Stack each column from the top, centred.
  const stack = (column: FlowNode[]) => {
    let y = 0;
    for (const n of column) {
      n.y = y;
      y += n.h + gap;
    }
    const used = y - gap;
    const shift = TOP + (areaH - used) / 2;
    for (const n of column) n.y += shift;
  };
  columns.forEach(stack);

  const centre = (n: FlowNode) => n.y + n.h / 2;
  /** Slide a column's nodes toward the average height of what they connect to, then pack them so none overlap. */
  const relax = (column: FlowNode[], neighbours: (id: string) => Edge[] | undefined, pick: (e: Edge) => string) => {
    const wanted = column.map((n) => {
      const list = neighbours(n.node.id) ?? [];
      const w = list.reduce((a, e) => a + e.value, 0);
      return { n, y: w ? list.reduce((a, e) => a + centre(flow.get(pick(e)) as FlowNode) * e.value, 0) / w - n.h / 2 : n.y };
    });
    wanted.sort((a, b) => a.y - b.y);
    let cursor = TOP;
    const placed = wanted.map((w) => {
      const y = Math.max(w.y, cursor);
      cursor = y + w.n.h + gap;
      return y;
    });
    // Keep the group inside the area, then let each one settle.
    const overflow = Math.max(cursor - gap - (TOP + areaH), 0);
    wanted.forEach((w, i) => {
      w.n.y = Math.max(placed[i] - overflow, TOP);
    });
    column.sort((a, b) => a.y - b.y);
  };

  for (let pass = 0; pass < 6; pass++) {
    for (let c = 1; c < COLUMNS.length; c++) relax(columns[c], (id) => inEdges.get(id), (e) => e.source);
    for (let c = COLUMNS.length - 2; c >= 0; c--) relax(columns[c], (id) => outEdges.get(id), (e) => e.target);
  }

  // Centre the whole picture in the free area, so a filtered view sits in the middle instead of hugging the top.
  if (flow.size) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const n of flow.values()) {
      lo = Math.min(lo, n.y);
      hi = Math.max(hi, n.y + n.h + 18); // the label under each node
    }
    const shift = TOP + areaH / 2 - (lo + hi) / 2;
    for (const n of flow.values()) n.y += shift;
  }

  const links: FlowLink[] = edges.map((e) => {
    const a = flow.get(e.source) as FlowNode;
    const b = flow.get(e.target) as FlowNode;
    const x0 = a.x + a.r;
    const x1 = b.x - b.r;
    const mid = (x0 + x1) / 2;
    const y0 = centre(a);
    const y1 = centre(b);
    return {
      id: e.source + ">" + e.target,
      source: e.source,
      target: e.target,
      state: e.state,
      d: "M" + x0 + "," + y0 + " C" + mid + "," + y0 + " " + mid + "," + y1 + " " + x1 + "," + y1,
    };
  });

  return {
    nodes: flow,
    links,
    columnX,
    columnCount: columns.map((c) => c.length),
  };
}
