import { buildApp } from './app.js';
import { pgStore } from './codemap-store.js';

const port = Number(process.env.PORT ?? 4000);
await buildApp({ store: process.env.DATABASE_URL ? pgStore() : undefined }).listen({ port, host: '0.0.0.0' });
