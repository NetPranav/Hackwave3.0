import type { CodeMap } from '@seismo/contracts';
import { connect } from './db/index.js';
import { codeMaps } from './db/schema.js';

/** Stores the latest code map per repo. Postgres when DATABASE_URL is set, memory otherwise (tests). */
export interface CodeMapStore {
  put(map: CodeMap): Promise<void>;
  all(): Promise<CodeMap[]>;
}

export function memoryStore(): CodeMapStore {
  const m = new Map<string, CodeMap>();
  return { put: async (c) => void m.set(c.repo, c), all: async () => [...m.values()] };
}

export function pgStore(url = process.env.DATABASE_URL): CodeMapStore {
  const { db } = connect(url);
  return {
    async put(c) {
      await db.insert(codeMaps).values({ repo: c.repo, commit: c.commit, payload: c, scannedAt: new Date(c.scannedAt) })
        .onConflictDoUpdate({ target: codeMaps.repo, set: { commit: c.commit, payload: c, scannedAt: new Date(c.scannedAt) } });
    },
    async all() {
      return (await db.select().from(codeMaps)).map((r) => r.payload as CodeMap);
    },
  };
}
