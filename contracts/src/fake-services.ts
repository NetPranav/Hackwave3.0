import { z } from 'zod';

export const ServiceName = z.enum(['users', 'payments', 'shipping', 'orders']);
export const Scenario = z.object({ id: z.string(), service: ServiceName, title: z.string(), kind: z.enum(['rename', 'units', 'enum', 'pagination', 'default', 'error', 'rate-limit']), description: z.string() });
export type Scenario = z.infer<typeof Scenario>;
export const ServiceVersions = z.record(ServiceName, z.union([z.literal(1), z.literal(2)]));
export const RolloutRequest = z.object({ percent: z.number().min(0).max(100) });

/** Demo scenarios (docs/roadmap/P1). */
export const SCENARIOS: Scenario[] = [
  { id: 'users-rename', service: 'users', title: 'users: email → emailAddress', kind: 'rename', description: 'Field renamed silently.' },
  { id: 'payments-paise', service: 'payments', title: 'payments: amount in paise', kind: 'units', description: 'Amount unit changes ×100.' },
  { id: 'shipping-enum', service: 'shipping', title: 'shipping: new status enum value', kind: 'enum', description: 'Unknown enum value appears.' },
  { id: 'orders-limit', service: 'orders', title: 'orders: limit capped at 100', kind: 'pagination', description: 'Requested 500 returns 100.' },
];
