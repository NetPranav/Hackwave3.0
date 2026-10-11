import { SCENARIOS } from './fake-services.js';
import type { Graph } from './graph.js';
import type { ServiceStatus, Overview, Me } from './status.js';
import type { DriftEvent, RadarItem, NotificationSettings, ReviewItem } from './drift.js';

const NOW = '2026-10-20T10:00:00.000Z';
const spark = (n: number) => Array.from({ length: 24 }, (_, i) => Math.round(n + Math.sin(i / 3) * n * 0.2));

export const mockMe = (): Me => ({ login: 'demo-user', name: 'Demo User', installations: ['inst-1'] });

export const mockGraph = (): Graph => ({
  nodes: [
    { id: 'svc:users', type: 'service', label: 'users', state: 'breaking', size: 20 },
    { id: 'ep:users:GET /users/{id}', type: 'endpoint', label: 'GET /users/{id}', state: 'breaking', service: 'users', size: 10 },
    { id: 'f:users:email', type: 'field', label: 'email', state: 'breaking', service: 'users' },
    { id: 'code:shop/checkout.ts:42', type: 'code', label: 'checkout.ts:42', state: 'breaking' },
    { id: 'wf:checkout', type: 'workflow', label: 'Checkout', state: 'breaking' },
    { id: 'svc:payments', type: 'service', label: 'payments', state: 'normal', size: 20 },
  ],
  links: [
    { source: 'svc:users', target: 'ep:users:GET /users/{id}', kind: 'has' },
    { source: 'ep:users:GET /users/{id}', target: 'f:users:email', kind: 'has' },
    { source: 'code:shop/checkout.ts:42', target: 'f:users:email', kind: 'reads' },
    { source: 'code:shop/checkout.ts:42', target: 'wf:checkout', kind: 'in' },
  ],
});

export const mockStatus = (): ServiceStatus[] =>
  ['users', 'payments', 'shipping', 'orders'].map((s, i) => ({
    service: s, state: i === 0 ? 'breaking' : 'normal', provider: 'operational', callsPerMin: 40 + i * 10, errorRate: 0.01,
    p95Ms: 120 + i * 30, lastSeen: NOW, sparkline: spark(40 + i * 10),
    endpoints: [{ endpoint: '/' + s, method: 'GET', state: i === 0 ? 'breaking' : 'normal', callsPerMin: 40, errorRate: 0.01, p95Ms: 130, rate429: 0, fieldsMapped: 6 }],
  }));

export const mockOverview = (): Overview => ({ servicesMonitored: 4, endpoints: 9, coveragePct: 82, openDrifts: { info: 1, warning: 1, breaking: 1 }, fixPrsOpen: 1, radarUpcoming: 2 });

export const mockDrift = (): DriftEvent[] => [
  {
    id: 'drift-1', service: 'users', endpoint: 'GET /users/{id}', field: 'email', detector: 'D1', title: 'Field renamed: email → emailAddress',
    severity: 'breaking', state: 'fix_pending', confidence: 0.94, detectedAt: NOW, before: { email: 'a@b.c' }, after: { emailAddress: 'a@b.c' },
    usages: [{ file: 'src/checkout.ts', line: 42, kind: 'read' }],
    explanation: { summary: 'The email field was renamed.', impact: 'Checkout reads user.email.', suggestion: 'Add an alias rule.', confidence: 0.94, model: 'template', latencyMs: 0, source: 'template' },
    fix: { rung: 'alias', rule: { endpoint: 'GET /users/{id}', source: 'emailAddress', target: 'email' } },
  },
];

export const mockReview = (): ReviewItem[] => [{ id: 'rev-1', drift: { ...mockDrift()[0]!, id: 'drift-2', detector: 'D9', title: 'Amount unit changed ×100', service: 'payments', field: 'amount', fix: undefined }, suggestion: 'Review: money field', status: 'open' }];
export const mockRadar = (): RadarItem[] => [{ id: 'rad-1', service: 'payments', title: 'v1 charges API sunset', kind: 'sunset', date: '2026-12-01', source: 'Sunset header', matchedFiles: ['src/pay.ts'] }];
export const mockNotificationSettings = (): NotificationSettings => ({
  whatsapp: { enabled: true, to: '+10000000000' }, slack: { enabled: false }, discord: { enabled: false }, email: { enabled: false }, github: { enabled: true }, minSeverity: 'warning', aiEnabled: true,
});
export const mockScenarios = () => SCENARIOS;
