import type { DriftEvent } from '@seismo/contracts';
import { eq, inArray } from 'drizzle-orm';
import { connect } from './db/index.js';
import { driftEvents } from './db/schema.js';

/** What the engine must remember across restarts: the event plus its bookkeeping (runs, PR dispatched, review reason). */
export interface StoredEvent { key: string; event: DriftEvent; runs: number; lastSeen: number; dispatched?: boolean; reviewReason?: string; /** passes in a row without the finding while the endpoint had traffic */ misses?: number; /** why it was resolved: the provider went back (a recurrence is a NEW change) or a fix */ resolvedBy?: 'recovered' | 'fix' }

export interface EventStore {
  load(): Promise<StoredEvent[]>;
  save(items: StoredEvent[]): Promise<void>;
  remove(ids: string[]): Promise<void>;
}

export function memoryEvents(): EventStore {
  const m = new Map<string, StoredEvent>();
  return {
    load: async () => [...m.values()].map((x) => structuredClone(x)),
    save: async (items) => { for (const i of items) m.set(i.event.id, structuredClone(i)); },
    remove: async (ids) => { for (const id of ids) m.delete(id); },
  };
}

/** Postgres: the drift_events table (indexed columns for queries, the full record in payload). */
export function pgEvents(projectId = process.env.SEISMO_PROJECT ?? 'dev', url = process.env.DATABASE_URL): EventStore {
  const { db } = connect(url);
  return {
    async load() {
      return (await db.select().from(driftEvents).where(eq(driftEvents.projectId, projectId))).map((r) => r.payload as StoredEvent);
    },
    async save(items) {
      for (const i of items) {
        const row = { id: i.event.id, projectId, service: i.event.service, detector: i.event.detector, severity: i.event.severity, state: i.event.state, confidence: i.event.confidence, detectedAt: new Date(i.event.detectedAt), payload: i };
        await db.insert(driftEvents).values(row).onConflictDoUpdate({ target: driftEvents.id, set: { severity: row.severity, state: row.state, confidence: row.confidence, payload: row.payload } });
      }
    },
    async remove(ids) { if (ids.length) await db.delete(driftEvents).where(inArray(driftEvents.id, ids)); },
  };
}
