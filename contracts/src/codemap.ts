import { z } from 'zod';

export const UsageKind = z.enum(['read', 'branch', 'money', 'persist', 'display', 'pass_through']);
export type UsageKind = z.infer<typeof UsageKind>;

export const CallSite = z.object({
  id: z.string(), repo: z.string(), file: z.string(), line: z.number().int(),
  service: z.string(), method: z.string(), endpoint: z.string(),
  fnName: z.string().optional(),
});
export const FieldRead = z.object({
  callSiteId: z.string(), field: z.string(), file: z.string(), line: z.number().int(), usage: UsageKind,
});
export const Workflow = z.object({ id: z.string(), name: z.string(), file: z.string(), functions: z.array(z.string()) });

export const CodeMap = z.object({
  repo: z.string(), commit: z.string(), scannedAt: z.string().datetime(),
  callSites: z.array(CallSite), fieldReads: z.array(FieldRead), workflows: z.array(Workflow),
});
export type CodeMap = z.infer<typeof CodeMap>;
