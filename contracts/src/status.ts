import { z } from 'zod';
import { DriftState } from './common.js';

export const EndpointStatus = z.object({
  endpoint: z.string(), method: z.string(), state: DriftState,
  callsPerMin: z.number(), errorRate: z.number(), p95Ms: z.number(), rate429: z.number(), fieldsMapped: z.number(),
});
export const ServiceStatus = z.object({
  service: z.string(), state: DriftState,
  provider: z.enum(['operational', 'degraded', 'outage', 'unknown']),
  callsPerMin: z.number(), errorRate: z.number(), p95Ms: z.number(), lastSeen: z.string().datetime(),
  upcomingChange: z.string().optional(), sparkline: z.array(z.number()), endpoints: z.array(EndpointStatus),
});
export type ServiceStatus = z.infer<typeof ServiceStatus>;
export const StatusResponse = z.object({ services: z.array(ServiceStatus) });

export const Overview = z.object({
  servicesMonitored: z.number(), endpoints: z.number(), coveragePct: z.number(),
  openDrifts: z.object({ info: z.number(), warning: z.number(), breaking: z.number() }),
  fixPrsOpen: z.number(), radarUpcoming: z.number(),
});
export type Overview = z.infer<typeof Overview>;

export const MetricsDay = z.object({
  date: z.string(),
  buckets: z.array(z.object({ start: z.string(), calls: z.number().nullable(), p95Ms: z.number().nullable(), drifts: z.number().nullable() })),
});
export const Metrics = z.array(MetricsDay);
export const Me = z.object({ login: z.string(), name: z.string().optional(), avatarUrl: z.string().optional(), installations: z.array(z.string()), appSlug: z.string().optional(), installUrl: z.string().optional() });
export type Me = z.infer<typeof Me>;
