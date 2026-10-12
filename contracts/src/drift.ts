import { z } from 'zod';
import { DetectorId, DriftState, Severity } from './common.js';

export const FixRung = z.enum(['alias', 'transform', 'behaviour']);
/** One data rule in the customer's seismo/aliases.json. Adds `target` from `source` when `target` is missing (docs/roadmap/P5 §1). */
export const AliasRule = z.object({
  id: z.string().optional(),
  kind: z.literal('alias').default('alias'),
  endpoint: z.string(),                 // "GET /users/{id}"
  path: z.string().default('$'),        // "$", "$.customer", "$.items[*]"
  target: z.string(),                   // the name the app reads (old)
  source: z.string(),                   // the name the provider now sends (new)
  driftEvent: z.string().optional(),
  addedAt: z.string().optional(),
});
export type AliasRule = z.infer<typeof AliasRule>;

/**
 * A unit-change fix (P5.10): divide one numeric field by an exact factor. NOT additive, so it is never automatic:
 * only proposed in a `needs-review` PR a human asked for, and applied by `applyTransforms` (separate from applyAliases).
 */
export const ScaleRule = z.object({
  id: z.string().optional(),
  kind: z.literal('scale'),
  endpoint: z.string(),
  path: z.string().default('$'),
  field: z.string(),
  divideBy: z.number().positive(),
  driftEvent: z.string().optional(),
  addedAt: z.string().optional(),
});
export type ScaleRule = z.infer<typeof ScaleRule>;
/** v2 fix template for a type change: lossless conversion back to the type the code expects. Review only. */
export const CoerceRule = z.object({
  id: z.string().optional(), kind: z.literal('coerce'), endpoint: z.string(), path: z.string().default('$'),
  field: z.string(), to: z.enum(['number', 'string']), driftEvent: z.string().optional(), addedAt: z.string().optional(),
});
export type CoerceRule = z.infer<typeof CoerceRule>;
/** v2 fix template for a new enum value: map it to a known one (chosen by the AI judge, approved by a human). Review only. */
export const MapRule = z.object({
  id: z.string().optional(), kind: z.literal('map'), endpoint: z.string(), path: z.string().default('$'),
  field: z.string(), map: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])), driftEvent: z.string().optional(), addedAt: z.string().optional(),
});
export type MapRule = z.infer<typeof MapRule>;
export const SeismoRule = z.union([AliasRule, ScaleRule, CoerceRule, MapRule]);
export type SeismoRule = z.infer<typeof SeismoRule>;

export const CheckResult = z.object({ id: z.enum(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9']), passed: z.boolean(), detail: z.string().optional() });
export const FixRequest = z.object({ driftId: z.string(), repo: z.string(), rung: FixRung, rule: SeismoRule.optional() });
export const ValidationResult = z.object({ driftId: z.string(), checks: z.array(CheckResult), ci: z.enum(['pending', 'green', 'red']), prUrl: z.string().url().optional() });
export const AliasSpec = z.object({ version: z.literal(1).default(1), rules: z.array(SeismoRule) });

/** What the model must return (validated with zod). Anything else is rejected and retried, then replaced by a template. */
export const AiExplanationBody = z.object({
  title: z.string().min(3).max(120),
  summary: z.string().min(10).max(600),
  impact: z.string().min(3).max(400),
  recommendation: z.string().min(3).max(400),
  risk: z.enum(['low', 'medium', 'high']),
  channels: z.object({
    whatsapp: z.string().min(10).max(300),
    slack: z.string().min(10).max(1500),
    emailSubject: z.string().min(3).max(140),
    emailBody: z.string().min(10).max(3000),
  }),
});
export type AiExplanationBody = z.infer<typeof AiExplanationBody>;

/** Semantic judge (enum meaning, ambiguous rename, unit sanity). Advice only: never decides or acts. */
export const AiJudgement = z.object({ choice: z.string().min(1).max(80), confidence: z.number().min(0).max(1), reason: z.string().min(3).max(200) });
export type AiJudgement = z.infer<typeof AiJudgement>;

export const AiExplanation = AiExplanationBody.extend({
  confidence: z.number().min(0).max(1),
  model: z.string(), latencyMs: z.number(), source: z.enum(['ai', 'template']),
  judgement: AiJudgement.optional(),
});
export type AiExplanation = z.infer<typeof AiExplanation>;

export const Usage = z.object({
  file: z.string(), line: z.number().int(), kind: z.string(), url: z.string().optional(),
  // filled from the current code map when served to the dashboard
  repo: z.string().optional(), snippet: z.string().optional(), workflows: z.array(z.string()).optional(),
});

export const DriftEvent = z.object({
  id: z.string(), service: z.string(), endpoint: z.string(), field: z.string().optional(),
  detector: DetectorId, title: z.string(), severity: Severity, state: DriftState, confidence: z.number().min(0).max(1),
  detectedAt: z.string().datetime(), before: z.unknown(), after: z.unknown(),
  usages: z.array(Usage), explanation: AiExplanation.optional(),
  fix: z.object({ rung: FixRung, rule: SeismoRule.optional(), validation: ValidationResult.optional() }).optional(),
  /** v3-P2: self-healing status (served live to the SDK, responses healed so far, last time one was healed) */
  heal: z.object({ live: z.boolean(), hits: z.number(), lastAt: z.string().optional() }).optional(),
});
export type DriftEvent = z.infer<typeof DriftEvent>;

/** suggestion: deterministic text from the template catalog (never AI). reason: why this is not an automatic PR. */
export const ReviewItem = z.object({ id: z.string(), drift: DriftEvent, suggestion: z.string(), reason: z.string().optional(),
  /** v2: the data rule a fix template would add (preview; a human opens the PR), absent when only a code change helps */
  proposedRule: SeismoRule.optional(), status: z.enum(['open', 'expected', 'snoozed', 'pr_opened']) });
export type ReviewItem = z.infer<typeof ReviewItem>;
export const ReviewAction = z.object({ id: z.string(), action: z.enum(['expected', 'snooze', 'open_pr', 'reopen']) });

export const Channel = z.enum(['dashboard', 'github', 'whatsapp', 'slack', 'discord', 'email']);
export type Channel = z.infer<typeof Channel>;
export const Notification = z.object({ id: z.string(), driftId: z.string(), channel: Channel, title: z.string(), sentAt: z.string().datetime(), ok: z.boolean(), error: z.string().optional(), read: z.boolean().default(false) });
export type Notification = z.infer<typeof Notification>;
const ChannelThreshold = { minSeverity: Severity.optional() };
export const NotificationSettings = z.object({
  whatsapp: z.object({ enabled: z.boolean(), to: z.string().optional(), ...ChannelThreshold }),
  slack: z.object({ enabled: z.boolean(), webhookUrl: z.string().optional(), ...ChannelThreshold }),
  discord: z.object({ enabled: z.boolean(), webhookUrl: z.string().optional(), ...ChannelThreshold }),
  email: z.object({ enabled: z.boolean(), to: z.string().optional(), ...ChannelThreshold }),
  github: z.object({ enabled: z.boolean(), ...ChannelThreshold }),
  minSeverity: Severity, aiEnabled: z.boolean(),
  /** v3-P2: serve confirmed rename rules live to the SDK (self-healing) before their PR is merged */
  autoHeal: z.boolean().optional(),
});
export type NotificationSettings = z.infer<typeof NotificationSettings>;

export const ChangeType = z.enum(['rename', 'removal', 'type', 'units', 'limit', 'pagination', 'deprecation', 'enum', 'other']);
export type ChangeType = z.infer<typeof ChangeType>;

/** One announced change, extracted from a changelog / spec. `quote` must be a verbatim substring of the source. */
export const AnnouncedChange = z.object({
  endpoint: z.string().max(200).optional(),
  field: z.string().max(120).optional(),
  changeType: ChangeType,
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  summary: z.string().min(5).max(300),
  quote: z.string().min(5).max(500),
});
export type AnnouncedChange = z.infer<typeof AnnouncedChange>;
export const AnnouncedChanges = z.object({ changes: z.array(AnnouncedChange).max(20) });

export const RadarItem = z.object({
  id: z.string(), service: z.string(), title: z.string(),
  kind: z.enum(['deprecation', 'sunset', 'changelog', 'breaking', 'spec']),
  changeType: ChangeType.default('other'),
  date: z.string().optional(),                 // effective date (YYYY-MM-DD) or header date
  source: z.string(),                          // "changelog (RSS)", "OpenAPI diff", "Sunset header"
  sourceUrl: z.string().optional(),
  quote: z.string().optional(),                // verbatim from the source
  endpoint: z.string().optional(), field: z.string().optional(),
  matchedFiles: z.array(z.string()),           // file:line of code that will be affected
  severity: Severity.default('info'),
  suggestion: z.string().default(''),          // deterministic template text
  extractedBy: z.enum(['ai', 'rules', 'header', 'spec']).default('rules'),
  driftEventId: z.string().optional(),         // set when traffic later shows the change
  detectedAt: z.string().optional(),
});
export type RadarItem = z.infer<typeof RadarItem>;

/** Baseline vs current synthetic examples built from fingerprint statistics (never real values). */
export const FieldDiff = z.object({ path: z.string(), change: z.enum(['added', 'removed', 'type', 'magnitude', 'enum', 'length']), before: z.unknown().optional(), after: z.unknown().optional() });
/** Statistics of one field in one window (v2: API Status field table). Shapes only: no record values. */
export const FieldProfile = z.object({
  type: z.string(), format: z.string().optional(), presence: z.number(), nullRate: z.number(),
  magnitude: z.number().optional(),            // dominant order of magnitude (10^n) for numbers
  lengthP50: z.number().optional(),            // strings
  enumValues: z.array(z.string()).optional(),  // allow-listed labels only
  arrayMax: z.number().optional(),
});
export const FieldRow = z.object({ path: z.string(), before: FieldProfile.optional(), after: FieldProfile.optional() });
export const Compare = z.object({ service: z.string(), endpoint: z.string(), v1: z.unknown(), v2: z.unknown(), diff: z.array(FieldDiff), fields: z.array(FieldRow).optional(), samples: z.object({ before: z.number(), after: z.number() }).optional() });
export type Compare = z.infer<typeof Compare>;
export const SimulateRequest = z.object({
  service: z.string(), endpoint: z.string(),
  scenario: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('rename'), field: z.string(), to: z.string() }),
    z.object({ kind: z.literal('remove'), field: z.string() }),
    z.object({ kind: z.literal('type'), field: z.string(), to: z.enum(['string', 'number', 'boolean', 'null']) }),
    z.object({ kind: z.literal('units'), field: z.string(), factor: z.number() }),
    z.object({ kind: z.literal('enum'), field: z.string(), value: z.string() }),
    z.object({ kind: z.literal('limit'), field: z.string(), max: z.number().int() }),
  ]),
});
export type SimulateRequest = z.infer<typeof SimulateRequest>;
export const SimulateResult = z.object({ detector: z.string(), affected: z.array(Usage), severity: Severity, fixRung: FixRung, workflows: z.array(z.string()), explanation: z.string() });
export type SimulateResult = z.infer<typeof SimulateResult>;
