import { createHash, randomBytes } from 'node:crypto';
import type { Fingerprint } from '@seismo/contracts';
import { eq, gt } from 'drizzle-orm';
import { connect } from './db/index.js';
import { fingerprints, projects, sdkKeys } from './db/schema.js';

export interface IngestStore {
  add(projectId: string, fp: Fingerprint): Promise<void>;
  since(projectId: string, sinceMs: number): Promise<Fingerprint[]>;
}

export function memoryIngest(): IngestStore {
  const rows: { projectId: string; at: number; fp: Fingerprint }[] = [];
  return {
    add: async (projectId, fp) => void rows.push({ projectId, at: Date.parse(fp.windowStart), fp }),
    since: async (projectId, sinceMs) => rows.filter((r) => r.projectId === projectId && r.at >= sinceMs).map((r) => r.fp),
  };
}

export function pgIngest(url = process.env.DATABASE_URL): IngestStore {
  const { db } = connect(url);
  return {
    async add(projectId, fp) {
      await db.insert(fingerprints).values({ id: randomBytes(8).toString('hex'), projectId, service: fp.service, endpoint: fp.endpoint, windowStart: new Date(fp.windowStart), payload: fp });
    },
    async since(projectId, sinceMs) {
      const rows = await db.select().from(fingerprints).where(gt(fingerprints.windowStart, new Date(sinceMs)));
      return rows.filter((r) => r.projectId === projectId).map((r) => r.payload as Fingerprint);
    },
  };
}

/** Optional write-through persistence for SDK keys (only hashes are stored). */
export interface KeyPersistence {
  load(): Promise<{ id: string; projectId: string; keyHash: string; revoked: boolean }[]>;
  insert(k: { id: string; projectId: string; keyHash: string }): Promise<void>;
  revoke(id: string): Promise<void>;
}

export function pgKeys(url = process.env.DATABASE_URL): KeyPersistence {
  const { db } = connect(url);
  return {
    async load() { return (await db.select().from(sdkKeys)).map((r) => ({ id: r.id, projectId: r.projectId, keyHash: r.keyHash, revoked: r.keyHash.startsWith('revoked:') })); },
    async insert(k) {
      await db.insert(projects).values({ id: k.projectId, owner: 'unknown' }).onConflictDoNothing();
      await db.insert(sdkKeys).values(k);
    },
    // a revoked key keeps its row (audit) but its hash can never match again
    async revoke(id) { const r = (await db.select().from(sdkKeys).where(eq(sdkKeys.id, id)))[0]; if (r && !r.keyHash.startsWith('revoked:')) await db.update(sdkKeys).set({ keyHash: `revoked:${r.keyHash}` }).where(eq(sdkKeys.id, id)); },
  };
}

/** SDK keys: shown once, stored as sha256. Env keys (SEISMO_SDK_KEYS) map to project "dev". */
export class SdkKeys {
  private hashes = new Map<string, { id: string; projectId: string; revoked: boolean }>();
  private persistence?: KeyPersistence;
  /** Load persisted keys and write new ones through. */
  async attach(p: KeyPersistence) {
    this.persistence = p;
    for (const k of await p.load()) this.hashes.set(k.keyHash, { id: k.id, projectId: k.projectId, revoked: k.revoked });
  }
  private sha = (k: string) => createHash('sha256').update(k).digest('hex');
  constructor(envKeys = process.env.SEISMO_SDK_KEYS ?? 'dev-key') {
    for (const k of envKeys.split(',').filter(Boolean)) this.hashes.set(this.sha(k), { id: 'env', projectId: 'dev', revoked: false });
  }
  create(projectId: string) {
    const key = `sk_${randomBytes(24).toString('hex')}`;
    const id = randomBytes(4).toString('hex');
    this.hashes.set(this.sha(key), { id, projectId, revoked: false });
    void this.persistence?.insert({ id, projectId, keyHash: this.sha(key) }).catch(() => undefined);
    return { id, key };
  }
  revoke(id: string) {
    for (const v of this.hashes.values()) if (v.id === id) v.revoked = true;
    void this.persistence?.revoke(id).catch(() => undefined);
  }
  verify(key: string): string | null {
    const v = this.hashes.get(this.sha(key));
    return v && !v.revoked ? v.projectId : null;
  }
}
