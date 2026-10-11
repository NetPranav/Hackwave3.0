import { z } from 'zod';
import { DriftState } from './common.js';

export const NodeType = z.enum(['service', 'endpoint', 'field', 'code', 'workflow']);
export const GraphNode = z.object({
  id: z.string(), type: NodeType, label: z.string(), state: DriftState,
  size: z.number().optional(), service: z.string().optional(),
  deprecationDate: z.string().optional(), unused: z.boolean().optional(),
});
export const GraphLink = z.object({ source: z.string(), target: z.string(), kind: z.enum(['has', 'reads', 'in', 'feeds']) });
export const Graph = z.object({ nodes: z.array(GraphNode), links: z.array(GraphLink) });
export type Graph = z.infer<typeof Graph>;

export const Installation = z.object({
  id: z.string(), account: z.string(), repos: z.array(z.object({ name: z.string(), scan: z.enum(['pending', 'running', 'done', 'failed']), progress: z.number().min(0).max(1) })),
});
export type Installation = z.infer<typeof Installation>;

export const Coverage = z.object({ endpointsMapped: z.number(), endpointsSeen: z.number(), fieldsMapped: z.number(), fieldsSeen: z.number() });
