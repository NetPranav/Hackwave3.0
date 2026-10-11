import { z } from 'zod';

/**
 * Shape-only fingerprint of one endpoint over one window (docs/PS/architecture.md §3.3).
 * It never carries a record's values: strings are classified (type/format/length), numbers appear only as
 * order-of-magnitude histograms and batch percentiles (no min/max, held back below 5 values), identifiers and
 * enum candidates are HMAC-hashed with a salt that never leaves the customer's server. The only plain values are
 * enum labels of fields on the customer's explicit allow-list.
 */
const Counts = z.record(z.string(), z.number().int());
const Pct = z.object({ p5: z.number(), p50: z.number(), p95: z.number() });

export const FieldFp = z.object({
  n: z.number().int(),                       // responses in this window where the field was present
  types: Counts,                             // string | number | integer | boolean | null | object | array
  nulls: z.number().int(),
  fmt: Counts.optional(),                    // format class -> count (email, uuid, prefixed_id, iso_date, epoch_s, ...)
  len: Pct.optional(),                       // string length percentiles
  mag: Counts.optional(),                    // floor(log10(|x|)) -> count
  num: Pct.optional(),                       // batch percentiles, only when >= 5 values
  enumValues: Counts.optional(),             // ONLY for allow-listed fields: label -> count
  hashes: Counts.optional(),                 // salted hash -> count for enum candidates (<= 20 distinct)
  arrayLen: z.object({ p50: z.number(), max: z.number(), atMax: z.number().int() }).optional(),
  idHashes: z.array(z.string()).optional(),  // salted hashes of array item ids (pagination overlap)
});
export type FieldFp = z.infer<typeof FieldFp>;

export const Fingerprint = z.object({
  v: z.literal(1),
  service: z.string(),
  method: z.string(),
  endpoint: z.string(),                       // normalised template, e.g. "/users/{id}"
  statusClass: z.enum(['2xx', '3xx', '4xx', '5xx']).default('2xx'), // windows are split by class so error bodies never mix with success bodies
  windowStart: z.string().datetime(),
  windowSeconds: z.number().int(),
  count: z.number().int(),                    // sampled responses in the window
  statusCounts: Counts,                       // "200" -> n
  latencyMs: z.object({ p50: z.number(), p95: z.number() }),
  headers: z.object({
    deprecation: z.string().optional(), sunset: z.string().optional(), rateLimitLimit: z.string().optional(),
    rateLimitRemaining: z.string().optional(), contentType: z.string().optional(),
  }),
  reqQueryKeys: z.array(z.string()),          // keys only; values dropped except limit-like params
  reqLimit: z.number().int().optional(),      // the request's own limit/per_page value (customer-chosen, not a response value)
  shapeHash: z.string(),
  fields: z.record(z.string(), FieldFp),
});
export type Fingerprint = z.infer<typeof Fingerprint>;
