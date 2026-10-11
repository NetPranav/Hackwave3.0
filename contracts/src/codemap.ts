import { z } from 'zod';

export const UsageKind = z.enum(['read', 'display', 'arithmetic', 'branching', 'persistence', 'outbound']);
export type UsageKind = z.infer<typeof UsageKind>;

export const CallSite = z.object({
  id: z.string(), repo: z.string(), file: z.string(), line: z.number().int(),
  service: z.string(), method: z.string(), endpoint: z.string(),
  fnName: z.string().optional(),
  unresolved: z.boolean().optional(), // service/endpoint could not be determined statically
});
export const FieldRead = z.object({
  callSiteId: z.string(), field: z.string(), file: z.string(), line: z.number().int(), usage: UsageKind, money: z.boolean(),
  snippet: z.string().max(160).optional(),   // the source line of the read (customer code, not API data)
});
export const Workflow = z.object({ id: z.string(), name: z.string(), file: z.string(), functions: z.array(z.string()), globs: z.array(z.string()) });

export const CodeMap = z.object({
  repo: z.string(), commit: z.string(), scannedAt: z.string().datetime(),
  callSites: z.array(CallSite), fieldReads: z.array(FieldRead), workflows: z.array(Workflow),
});
export type CodeMap = z.infer<typeof CodeMap>;

/** GET /v1/codemap (v2): merged code maps for the dashboard, with the workflows each location belongs to. */
export const CodeMapView = z.object({
  repos: z.array(z.object({ repo: z.string(), commit: z.string(), scannedAt: z.string() })),
  callSites: z.array(CallSite.extend({ workflows: z.array(z.string()) })),
  fieldReads: z.array(FieldRead.extend({ repo: z.string(), workflows: z.array(z.string()) })),
  workflows: z.array(z.object({ id: z.string(), name: z.string(), file: z.string(), repo: z.string() })),
});
export type CodeMapView = z.infer<typeof CodeMapView>;
