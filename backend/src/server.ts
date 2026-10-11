import { buildApp } from './app.js';
import { pgStore } from './codemap-store.js';
import { pgIngest } from './ingest-store.js';

const port = Number(process.env.PORT ?? 4000);
const pg = !!process.env.DATABASE_URL;
await buildApp({ store: pg ? pgStore() : undefined, ingest: pg ? pgIngest() : undefined }).listen({ port, host: '0.0.0.0' });
