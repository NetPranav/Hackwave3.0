import { and, eq } from 'drizzle-orm';
import { connect } from './db/index.js';
import { projects } from './db/schema.js';

/**
 * P3.4: who owns a project. One deployment watches one project (`SEISMO_PROJECT`, default "dev"); the detection loop,
 * events and settings are all for that project. Ownership decides who may create, list and revoke its SDK keys:
 *  - `SEISMO_PROJECT_OWNERS` (comma-separated GitHub logins) fixes the owners;
 *  - otherwise the first signed-in user who touches the project claims it (stored in `projects.owner`).
 * With AUTH_SECRET unset (local dev) everyone is "demo-user", so the check always passes.
 */
export const PROJECT_ID = () => process.env.SEISMO_PROJECT ?? 'dev';

export interface OwnerStore {
  get(id: string): Promise<string | undefined>;
  /** Set the owner if the project has none; returns the owner afterwards. */
  claim(id: string, login: string): Promise<string>;
}

export function memoryOwners(): OwnerStore {
  const m = new Map<string, string>();
  return {
    get: async (id) => m.get(id),
    claim: async (id, login) => { if (!m.has(id) || m.get(id) === 'unknown') m.set(id, login); return m.get(id)!; },
  };
}

export function pgOwners(url = process.env.DATABASE_URL): OwnerStore {
  const { db } = connect(url);
  const get = async (id: string) => (await db.select().from(projects).where(eq(projects.id, id)))[0]?.owner;
  return {
    get,
    async claim(id, login) {
      await db.insert(projects).values({ id, owner: login }).onConflictDoNothing();
      // rows written before ownership existed say "unknown": the first real user takes them over
      await db.update(projects).set({ owner: login }).where(and(eq(projects.id, id), eq(projects.owner, 'unknown')));
      return (await get(id)) ?? login;
    },
  };
}

export class Projects {
  constructor(private store: OwnerStore = memoryOwners(), private fixed = (process.env.SEISMO_PROJECT_OWNERS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)) {}
  /** 'ok' | 'not_found' (another project id) | 'forbidden' (someone else's project). */
  async access(id: string, login: string): Promise<'ok' | 'not_found' | 'forbidden'> {
    if (id !== PROJECT_ID()) return 'not_found';
    if (login === 'demo-user' && !process.env.AUTH_SECRET) return 'ok';
    if (this.fixed.length) return this.fixed.includes(login.toLowerCase()) ? 'ok' : 'forbidden';
    const owner = await this.store.claim(id, login);
    return owner.toLowerCase() === login.toLowerCase() ? 'ok' : 'forbidden';
  }
  async list(login: string) {
    const id = PROJECT_ID();
    return (await this.access(id, login)) === 'ok' ? [{ id, owner: this.fixed[0] ?? (await this.store.get(id)) ?? login }] : [];
  }
}

/** Per-project token bucket for /v1/ingest. Over the limit the SDK gets 429 and drops the batch (it is fail-open). */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>();
  constructor(private perMinute = Number(process.env.INGEST_RATE_PER_MIN ?? 1200), private now = () => Date.now()) {}
  /** Returns 0 when allowed, otherwise the seconds to wait. */
  take(key: string): number {
    const t = this.now();
    const b = this.buckets.get(key) ?? { tokens: this.perMinute, at: t };
    b.tokens = Math.min(this.perMinute, b.tokens + ((t - b.at) / 60_000) * this.perMinute);
    b.at = t;
    this.buckets.set(key, b);
    if (b.tokens >= 1) { b.tokens -= 1; return 0; }
    return Math.max(1, Math.ceil(((1 - b.tokens) / this.perMinute) * 60));
  }
}
