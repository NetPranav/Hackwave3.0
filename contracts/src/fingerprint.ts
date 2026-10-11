import { z } from 'zod';

/** Shape-only fingerprint of one response batch. Never carries a record's values (AGENTS.md rule 2). */
export const FieldStat = z.object({
  path: z.string(),                         // e.g. "data[].user.email"
  types: z.record(z.string(), z.number()),  // type -> count
  presence: z.number().min(0).max(1),
  formatClass: z.string().optional(),       // e.g. "email", "iso-date", "uuid"
  lengthBuckets: z.array(z.number()).optional(),
  magnitude: z.number().int().optional(),   // order of magnitude only
  percentiles: z.object({ p10: z.number(), p50: z.number(), p90: z.number() }).optional(),
  enumValues: z.array(z.string()).optional(), // only for allow-listed enum fields
  saltedHashes: z.number().int().optional(),  // distinct-count sketch, hash stays SDK-side
});
export type FieldStat = z.infer<typeof FieldStat>;

export const Fingerprint = z.object({
  version: z.literal(1),
  sdkKeyId: z.string(),
  service: z.string(),
  method: z.string(),
  endpoint: z.string(),                     // templated, e.g. "/users/{id}"
  status: z.number().int(),
  latencyMs: z.number(),
  count: z.number().int(),
  windowStart: z.string().datetime(),
  windowSeconds: z.number().int(),
  headers: z.object({ deprecation: z.string().optional(), sunset: z.string().optional(), rateLimitRemaining: z.number().optional() }).optional(),
  fields: z.array(FieldStat),
});
export type Fingerprint = z.infer<typeof Fingerprint>;
