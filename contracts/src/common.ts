import { z } from 'zod';

export const Severity = z.enum(['info', 'warning', 'breaking']);
export type Severity = z.infer<typeof Severity>;

export const DriftState = z.enum(['normal', 'suspected', 'breaking', 'fix_pending', 'resolved', 'expected', 'snoozed']);
export type DriftState = z.infer<typeof DriftState>;

export const Id = z.string().min(1);
export const IsoDate = z.string().datetime();

/** Detector ids from docs/roadmap/P4 (D1..D17). */
export const DetectorId = z.string().regex(/^D\d{1,2}$/);

export const ApiError = z.object({ error: z.string(), message: z.string().optional() });
export type ApiError = z.infer<typeof ApiError>;
