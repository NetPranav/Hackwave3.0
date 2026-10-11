import { index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(), // GitHub login
  installationId: text('installation_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sdkKeys = pgTable(
  'sdk_keys',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id),
    keyHash: text('key_hash').notNull(), // sha256 of the key; the key itself is shown once
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('sdk_keys_hash').on(t.keyHash)],
);

export const fingerprints = pgTable(
  'fingerprints',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    service: text('service').notNull(),
    endpoint: text('endpoint').notNull(),
    windowStart: timestamp('window_start').notNull(),
    payload: jsonb('payload').notNull(), // contracts Fingerprint
  },
  (t) => [index('fp_lookup').on(t.projectId, t.service, t.endpoint, t.windowStart)],
);

export const baselines = pgTable(
  'baselines',
  {
    projectId: text('project_id').notNull(),
    service: text('service').notNull(),
    endpoint: text('endpoint').notNull(),
    payload: jsonb('payload').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('baseline_key').on(t.projectId, t.service, t.endpoint)],
);

export const driftEvents = pgTable('drift_events', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  service: text('service').notNull(),
  detector: text('detector').notNull(),
  severity: text('severity').notNull(),
  state: text('state').notNull(),
  confidence: real('confidence').notNull(),
  detectedAt: timestamp('detected_at').defaultNow().notNull(),
  payload: jsonb('payload').notNull(), // contracts DriftEvent
});

export const codeMaps = pgTable('code_maps', {
  repo: text('repo').primaryKey(),
  commit: text('commit').notNull(),
  payload: jsonb('payload').notNull(), // contracts CodeMap
  scannedAt: timestamp('scanned_at').defaultNow().notNull(),
});

export const settings = pgTable('settings', {
  projectId: text('project_id').primaryKey(),
  notifications: jsonb('notifications').notNull(),
  version: integer('version').default(1).notNull(),
});
