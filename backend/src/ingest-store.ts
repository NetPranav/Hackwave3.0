import { createHash, randomBytes } from 'node:crypto';
import type { Fingerprint } from '@seismo/contracts';
import { and, eq, gt, lt } from 'drizzle-orm';
import { connect } from './db/index.js';
import { fingerprints, projects, sdkKeys } from './db/schema.js';

export interface IngestStore {
  add(projectId: string, fp: Fingerprint): Promise<void>;
  /** fingerprints with windowStart after sinceMs (and before untilMs when given) */
  since(projectId: string, sinceMs: number, untilMs?: number): Promise<Fingerprint[]>;
  /** Demo reset only. */
  clear(projectId: string): Promise<void>;
  /** v3-P0.3 retention: delete fingerprints whose window started before `beforeMs`; returns how many. */
  prune(beforeMs: number): Promise<number>;
}

/**
 * Fingerprints in memory only, never in the database (lead's decision 2026-10-12: live traffic filled the free Postgres).
 * Bounded twice: by age (prune, run every minute with FINGERPRINT_RETENTION_HOURS) and by count (oldest dropped past
 * `max`). The engine keeps its own 10 s rollups, so detection needs only the recent rows. A restart forgets them:
 * Seismo relearns normal traffic in a few minutes.
 */
export function memoryIngest(max = Number(process.env.SEISMO_MAX_FINGERPRINTS ?? 50_000)): IngestStore {
  let rows: { projectId: string; at: number; fp: Fingerprint }[] = [];
  return {
    add: async (projectId, fp) => {
      rows.push({ projectId, at: Date.parse(fp.windowStart), fp });
      if (rows.length > max) rows = rows.slice(rows.length - max);
    },
    since: async (projectId, sinceMs, untilMs) => rows.filter((r) => r.projectId === projectId && r.at >= sinceMs && (untilMs === undefined || r.at < untilMs)).map((r) => r.fp),
    clear: async (projectId) => { rows = rows.filter((r) => r.projectId !== projectId); },
    prune: async (beforeMs) => { const n = rows.length; rows = rows.filter((r) => r.at >= beforeMs); return n - rows.length; },
  };
}

export function pgIngest(url = process.env.DATABASE_URL): IngestStore {
  const { db } = connect(url);
  return {
    async add(projectId, fp) {
      await db.insert(fingerprints).values({ id: randomBytes(8).toString('hex'), projectId, service: fp.service, endpoint: fp.endpoint, windowStart: new Date(fp.windowStart), payload: fp });
    },
    async since(projectId, sinceMs, untilMs) {
      const rows = await db.select({ payload: fingerprints.payload }).from(fingerprints).where(and(eq(fingerprints.projectId, projectId), gt(fingerprints.windowStart, new Date(sinceMs)), ...(untilMs === undefined ? [] : [lt(fingerprints.windowStart, new Date(untilMs))])));
      return rows.map((r) => r.payload as Fingerprint);
    },
    async clear(projectId) { await db.delete(fingerprints).where(eq(fingerprints.projectId, projectId)); },
    async prune(beforeMs) { return (await db.delete(fingerprints).where(lt(fingerprints.windowStart, new Date(beforeMs))).returning({ id: fingerprints.id })).length; },
  };
}

/** Optional write-through persistence for SDK keys (only hashes are stored). */
export interface KeyPersistence {
  load(): Promise<{ id: string; projectId: string; keyHash: string; revoked: boolean; createdAt?: string }[]>;
  insert(k: { id: string; projectId: string; keyHash: string; owner?: string }): Promise<void>;
  revoke(id: string): Promise<void>;
}

export function pgKeys(url = process.env.DATABASE_URL): KeyPersistence {
  const { db } = connect(url);
  return {
    async load() { return (await db.select().from(sdkKeys)).map((r) => ({ id: r.id, projectId: r.projectId, keyHash: r.keyHash, revoked: r.keyHash.startsWith('revoked:'), createdAt: r.createdAt.toISOString() })); },
    async insert(k) {
      await db.insert(projects).values({ id: k.projectId, owner: k.owner ?? 'unknown' }).onConflictDoNothing();
      await db.insert(sdkKeys).values(k);
    },
    // a revoked key keeps its row (audit) but its hash can never match again
    async revoke(id) { const r = (await db.select().from(sdkKeys).where(eq(sdkKeys.id, id)))[0]; if (r && !r.keyHash.startsWith('revoked:')) await db.update(sdkKeys).set({ keyHash: `revoked:${r.keyHash}` }).where(eq(sdkKeys.id, id)); },
  };
}

type KeyInfo = { id: string; projectId: string; revoked: boolean; createdAt: string };

/** SDK keys: shown once, stored as sha256. Env keys (SEISMO_SDK_KEYS) map to the deployment's project (SEISMO_PROJECT, default "dev"). */
export class SdkKeys {
  private hashes = new Map<string, KeyInfo>();
  private persistence?: KeyPersistence;
  /** Load persisted keys and write new ones through. */
  async attach(p: KeyPersistence) {
    this.persistence = p;
    for (const k of await p.load()) this.hashes.set(k.keyHash, { id: k.id, projectId: k.projectId, revoked: k.revoked, createdAt: k.createdAt ?? new Date(0).toISOString() });
  }
  private sha = (k: string) => createHash('sha256').update(k).digest('hex');
  constructor(envKeys = process.env.SEISMO_SDK_KEYS ?? 'dev-key') {
    for (const k of envKeys.split(',').filter(Boolean)) this.hashes.set(this.sha(k), { id: 'env', projectId: process.env.SEISMO_PROJECT ?? 'dev', revoked: false, createdAt: new Date(0).toISOString() });
  }
  create(projectId: string, owner?: string) {
    const key = `sk_${randomBytes(24).toString('hex')}`;
    const id = randomBytes(4).toString('hex');
    this.hashes.set(this.sha(key), { id, projectId, revoked: false, createdAt: new Date().toISOString() });
    void this.persistence?.insert({ id, projectId, keyHash: this.sha(key), ...(owner ? { owner } : {}) }).catch(() => undefined);
    return { id, key };
  }
  /** Revoke a key of this project. Returns false when the key does not exist or belongs to another project. */
  revoke(id: string, projectId?: string): boolean {
    const mine = [...this.hashes.values()].filter((v) => v.id === id && id !== 'env' && (projectId === undefined || v.projectId === projectId));
    if (!mine.length) return false;
    for (const v of mine) v.revoked = true;
    void this.persistence?.revoke(id).catch(() => undefined);
    return true;
  }
  /** Key ids of a project (never the keys themselves). Env keys are listed as id "env". */
  list(projectId: string) {
    const seen = new Map<string, { id: string; createdAt: string; revoked: boolean }>();
    for (const v of this.hashes.values()) if (v.projectId === projectId && !seen.has(v.id)) seen.set(v.id, { id: v.id, createdAt: v.createdAt, revoked: v.revoked });
    return [...seen.values()];
  }
  verify(key: string): string | null {
    const v = this.hashes.get(this.sha(key));
    return v && !v.revoked ? v.projectId : null;
  }
}
