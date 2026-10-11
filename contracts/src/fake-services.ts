import { z } from 'zod';

export const ServiceName = z.enum(['users', 'payments', 'shipping', 'orders']);
export const Scenario = z.object({ id: z.string(), service: ServiceName, title: z.string(), kind: z.enum(['rename', 'units', 'enum', 'pagination', 'default', 'error', 'rate-limit']), description: z.string() });
export type Scenario = z.infer<typeof Scenario>;
export const ServiceVersions = z.record(ServiceName, z.union([z.literal(1), z.literal(2)]));
export const RolloutRequest = z.object({ percent: z.number().min(0).max(100) });

/** Demo scenarios (docs/roadmap/P1). Each is an independent toggle; the detector it should trigger is in `detector`. */
export const SCENARIOS: (Scenario & { detector: string })[] = [
  { id: 'users-rename', service: 'users', title: 'users: name → display_name', kind: 'rename', detector: 'D3', description: 'Field renamed silently.' },
  { id: 'users-error-shape', service: 'users', title: 'users: error {error} → {errors:[]}', kind: 'error', detector: 'D11', description: 'Error body shape changes.' },
  { id: 'payments-paise', service: 'payments', title: 'payments: amount rupees → paise', kind: 'units', detector: 'D5', description: 'Amount unit changes ×100.' },
  { id: 'payments-amount-type', service: 'payments', title: 'payments: amount string → number', kind: 'default', detector: 'D4', description: 'Type change.' },
  { id: 'shipping-enum', service: 'shipping', title: 'shipping: new status partially_shipped', kind: 'enum', detector: 'D7', description: 'Unknown enum value appears.' },
  { id: 'shipping-deprecation', service: 'shipping', title: 'shipping: Sunset + Deprecation headers', kind: 'default', detector: 'D13', description: 'Deprecation headers appear.' },
  { id: 'orders-limit-cap', service: 'orders', title: 'orders: limit capped 500 → 100', kind: 'pagination', detector: 'D9', description: 'Requested 500 returns 100.' },
  { id: 'orders-cursor', service: 'orders', title: 'orders: page → cursor', kind: 'pagination', detector: 'D10', description: 'Pagination style changes.' },
];

export const ScenarioState = z.record(z.string(), z.object({ enabled: z.boolean(), percent: z.number() }));
