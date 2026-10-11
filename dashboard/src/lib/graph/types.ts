import type { CodeSite } from "@/lib/mock/codemap";
import type { FixRuleData } from "@/lib/mock/fixes";
import type { ServiceStatusItem } from "@/lib/mock/status";
import type { TimelineItem } from "@/lib/mock/timeline";

export type GraphNodeType = "service" | "endpoint" | "field" | "code" | "workflow";

/** What the graph is built from: the same data every screen uses (useSeismoData), live or mock. */
export interface GraphData {
  services: ServiceStatusItem[];
  timeline: TimelineItem[];
  fixes: FixRuleData[];
  sitesFor: (serviceSlug: string, field: string) => CodeSite[];
  unresolvedReads: { file: string; line: number; reason: string }[];
  /** link to a code location (GitHub), or undefined when the repo is unknown */
  codeUrl: (file: string, line: number) => string | undefined;
}

/** normal · suspected (amber) · breaking (orange) · fix = a fix is ready (green). */
export type GraphState = "normal" | "suspected" | "breaking" | "fix";

export interface NodeRef {
  serviceSlug: string;
  endpointId?: string;
  field?: string;
  file?: string;
  line?: number;
}

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  state: GraphState;
  /** Service slug this node belongs to. */
  cluster: string;
  /** A field nothing reads and nothing changed on: hidden unless asked for, dimmed when shown. */
  unused: boolean;
  /** endpoint: calls/min · field: number of code reads · service: calls/min. */
  weight: number;
  ref: NodeRef;
}

export interface GraphLink {
  source: string;
  target: string;
  state: GraphState;
}

export interface GraphMeta {
  mappedReads: number;
  unresolvedReads: number;
  counts: Record<GraphNodeType, number>;
}

export interface BuiltGraph {
  nodes: GraphNode[];
  links: GraphLink[];
  /** Outgoing and incoming neighbours by node id, for tracing paths. */
  out: Map<string, string[]>;
  inn: Map<string, string[]>;
  meta: GraphMeta;
  data: GraphData;
}

export const STATE_RANK: Record<GraphState, number> = { breaking: 0, suspected: 1, fix: 2, normal: 3 };

export const STATE_LABEL: Record<GraphState, string> = {
  normal: "Normal",
  suspected: "Suspected",
  breaking: "Breaking",
  fix: "Fix ready",
};
