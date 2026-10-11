import { buildApp } from './app.js';
import { pgStore } from './codemap-store.js';
import { pgIngest } from './ingest-store.js';
import { pgSettings } from './settings-store.js';

const port = Number(process.env.PORT ?? 4000);
const pg = !!process.env.DATABASE_URL;
const app = buildApp({ store: pg ? pgStore() : undefined, ingest: pg ? pgIngest() : undefined, settings: pg ? pgSettings() : undefined });
await app.listen({ port, host: '0.0.0.0' });
// Detection pass every 5 s (P4.2). Errors must never kill the API.
setInterval(() => { (app as unknown as { detectNow: () => Promise<unknown> }).detectNow().catch((e: unknown) => app.log.error(e)); }, 5000).unref();
