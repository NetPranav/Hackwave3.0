import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { PgBoss } from 'pg-boss';
import * as schema from './schema.js';

export function connect(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is not set');
  const pool = new pg.Pool({ connectionString: url });
  return { pool, db: drizzle(pool, { schema }) };
}

/** pg-boss job queue (P0.3). Consumers are registered in worker.ts. */
export async function startQueue(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is not set');
  const boss = new PgBoss(url);
  await boss.start();
  return boss;
}
