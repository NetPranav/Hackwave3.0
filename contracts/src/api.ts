import { z } from 'zod';
import { ApiError } from './common.js';
import { Graph, Installation, Coverage } from './graph.js';
import { StatusResponse, Overview, Me } from './status.js';
import { DriftEvent, ReviewItem, ReviewAction, RadarItem, NotificationSettings, Compare, SimulateRequest, SimulateResult } from './drift.js';
import { Fingerprint } from './fingerprint.js';
import { Scenario, ServiceVersions, RolloutRequest } from './fake-services.js';

export interface Route { method: 'get' | 'post' | 'put' | 'delete'; path: string; summary: string; request?: z.ZodType; response: z.ZodType; auth: 'user' | 'sdk-key' | 'admin-token' }

const Ok = z.object({ ok: z.literal(true) });
export const ROUTES: Route[] = [
  { method: 'get', path: '/v1/me', summary: 'Signed-in user and their installations', response: Me, auth: 'user' },
  { method: 'get', path: '/v1/overview', summary: 'KPI tiles', response: Overview, auth: 'user' },
  { method: 'get', path: '/v1/graph', summary: 'Dependency graph', response: Graph, auth: 'user' },
  { method: 'get', path: '/v1/graph/impact', summary: 'Upstream/downstream path of a node (query: node)', response: Graph, auth: 'user' },
  { method: 'get', path: '/v1/installations', summary: 'Installations, repos and scan progress', response: z.array(Installation), auth: 'user' },
  { method: 'get', path: '/v1/coverage', summary: 'Mapping coverage numbers', response: Coverage, auth: 'user' },
  { method: 'get', path: '/v1/status', summary: 'API status layer', response: StatusResponse, auth: 'user' },
  { method: 'get', path: '/v1/drift-events', summary: 'Timeline of drift events', response: z.array(DriftEvent), auth: 'user' },
  { method: 'get', path: '/v1/radar', summary: 'Changelog and deprecation radar', response: z.array(RadarItem), auth: 'user' },
  { method: 'get', path: '/v1/review', summary: 'Review queue', response: z.array(ReviewItem), auth: 'user' },
  { method: 'post', path: '/v1/review', summary: 'Mark expected / snooze / open suggestion PR', request: ReviewAction, response: Ok, auth: 'user' },
  { method: 'get', path: '/v1/compare', summary: 'Before/after sample for an endpoint (query: service, endpoint)', response: Compare, auth: 'user' },
  { method: 'post', path: '/v1/simulate', summary: 'Simulate a scenario against the code map', request: SimulateRequest, response: SimulateResult, auth: 'user' },
  { method: 'get', path: '/v1/settings/notifications', summary: 'Notification settings', response: NotificationSettings, auth: 'user' },
  { method: 'put', path: '/v1/settings/notifications', summary: 'Update notification settings', request: NotificationSettings, response: NotificationSettings, auth: 'user' },
  { method: 'post', path: '/v1/notifications/test', summary: 'Send a test notification', response: Ok, auth: 'user' },
  { method: 'get', path: '/v1/projects', summary: 'Projects the signed-in user owns (one per deployment in the MVP)', response: z.array(z.object({ id: z.string(), owner: z.string() })), auth: 'user' },
  { method: 'get', path: '/v1/projects/{id}/keys', summary: 'SDK key ids of a project (owner only; keys themselves are never returned)', response: z.array(z.object({ id: z.string(), createdAt: z.string(), revoked: z.boolean() })), auth: 'user' },
  { method: 'post', path: '/v1/projects/{id}/keys', summary: 'Create an SDK key (owner only; the key is shown once)', response: z.object({ id: z.string(), key: z.string() }), auth: 'user' },
  { method: 'delete', path: '/v1/projects/{id}/keys/{keyId}', summary: 'Revoke an SDK key (owner only; 404 for a key of another project)', response: Ok, auth: 'user' },
  { method: 'post', path: '/v1/ingest', summary: 'SDK fingerprint ingest (429 + Retry-After above INGEST_RATE_PER_MIN per project)', request: Fingerprint, response: Ok, auth: 'sdk-key' },
  { method: 'get', path: '/admin/scenarios', summary: 'Demo scenarios', response: z.array(Scenario), auth: 'admin-token' },
  { method: 'post', path: '/admin/scenarios/{id}', summary: 'Flip a scenario to v2', response: ServiceVersions, auth: 'admin-token' },
  { method: 'post', path: '/admin/rollout/{id}', summary: 'Gradual rollout percent', request: RolloutRequest, response: ServiceVersions, auth: 'admin-token' },
  { method: 'post', path: '/admin/reset', summary: 'Reset all services to v1', response: ServiceVersions, auth: 'admin-token' },
  { method: 'get', path: '/admin/sample/{endpoint}', summary: 'Sample payload (query: version=1|2)', response: z.unknown(), auth: 'admin-token' },
];
export const Error = ApiError;
