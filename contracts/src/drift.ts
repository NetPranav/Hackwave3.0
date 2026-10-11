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

export const CheckResult = z.object({ id: z.enum(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8']), passed: z.boolean(), detail: z.string().optional() });
export const FixRequest = z.object({ driftId: z.string(), repo: z.string(), rung: FixRung, rule: AliasRule.optional() });
export const ValidationResult = z.object({ driftId: z.string(), checks: z.array(CheckResult), ci: z.enum(['pending', 'green', 'red']), prUrl: z.string().url().optional() });
export const AliasSpec = z.object({ version: z.literal(1).default(1), rules: z.array(AliasRule) });

export const AiExplanation = z.object({
  summary: z.string(), impact: z.string(), suggestion: z.string(), confidence: z.number().min(0).max(1),
  model: z.string(), latencyMs: z.number(), source: z.enum(['ai', 'template']),
});
export type AiExplanation = z.infer<typeof AiExplanation>;

export const Usage = z.object({ file: z.string(), line: z.number().int(), kind: z.string(), url: z.string().optional() });

export const DriftEvent = z.object({
  id: z.string(), service: z.string(), endpoint: z.string(), field: z.string().optional(),
  detector: DetectorId, title: z.string(), severity: Severity, state: DriftState, confidence: z.number().min(0).max(1),
  detectedAt: z.string().datetime(), before: z.unknown(), after: z.unknown(),
  usages: z.array(Usage), explanation: AiExplanation.optional(),
  fix: z.object({ rung: FixRung, rule: AliasRule.optional(), validation: ValidationResult.optional() }).optional(),
});
export type DriftEvent = z.infer<typeof DriftEvent>;

export const ReviewItem = z.object({ id: z.string(), drift: DriftEvent, suggestion: z.string(), status: z.enum(['open', 'expected', 'snoozed', 'pr_opened']) });
export type ReviewItem = z.infer<typeof ReviewItem>;
export const ReviewAction = z.object({ id: z.string(), action: z.enum(['expected', 'snooze', 'open_pr']) });

export const Notification = z.object({ id: z.string(), driftId: z.string(), channel: z.enum(['dashboard', 'github', 'whatsapp', 'slack', 'discord', 'email']), sentAt: z.string().datetime(), ok: z.boolean() });
export const NotificationSettings = z.object({
  whatsapp: z.object({ enabled: z.boolean(), to: z.string().optional() }),
  slack: z.object({ enabled: z.boolean(), webhookUrl: z.string().optional() }),
  discord: z.object({ enabled: z.boolean(), webhookUrl: z.string().optional() }),
  email: z.object({ enabled: z.boolean(), to: z.string().optional() }),
  github: z.object({ enabled: z.boolean() }),
  minSeverity: Severity, aiEnabled: z.boolean(),
});
export type NotificationSettings = z.infer<typeof NotificationSettings>;

export const RadarItem = z.object({
  id: z.string(), service: z.string(), title: z.string(), kind: z.enum(['deprecation', 'sunset', 'changelog', 'breaking']),
  date: z.string().optional(), source: z.string(), matchedFiles: z.array(z.string()),
});
export type RadarItem = z.infer<typeof RadarItem>;

export const Compare = z.object({ service: z.string(), endpoint: z.string(), v1: z.unknown(), v2: z.unknown(), diff: z.unknown() });
export const SimulateRequest = z.object({ service: z.string(), endpoint: z.string(), scenario: z.string() });
export const SimulateResult = z.object({ affected: z.array(Usage), severity: Severity, fixRung: FixRung.optional() });
