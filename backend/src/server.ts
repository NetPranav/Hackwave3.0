import { buildApp } from './app.js';
import { pgStore } from './codemap-store.js';
import { pgIngest } from './ingest-store.js';
import { pgSettings } from './settings-store.js';
import { pgEvents } from './event-store.js';
import { DriftEngine } from './drift-engine.js';
import { httpFixDispatcher, httpGithubApp, httpInstallations } from './fix-dispatcher.js';
import { memoryStore } from './codemap-store.js';
import { memoryIngest, pgKeys, SdkKeys } from './ingest-store.js';
import { Projects, pgOwners } from './projects.js';
import { guardProduction } from './prod-guard.js';

guardProduction();

const port = Number(process.env.PORT ?? 4000);
const pg = !!process.env.DATABASE_URL;
const store = pg ? pgStore() : memoryStore();
const ingest = pg ? pgIngest() : memoryIngest();
const engine = new DriftEngine(ingest, () => store.all(), undefined, httpFixDispatcher(), pg ? pgEvents() : undefined);
await engine.init();   // remembered events are visible before the first detection pass
const keys = new SdkKeys();
if (pg) await keys.attach(pgKeys());
const app = buildApp({ store, ingest, engine, keys, settings: pg ? pgSettings() : undefined, installations: httpInstallations(), github: httpGithubApp(), ...(pg ? { projects: new Projects(pgOwners()) } : {}) });
await app.listen({ port, host: '0.0.0.0' });
// Detection pass every 5 s (P4.2). Errors must never kill the API.
setInterval(() => { (app as unknown as { detectNow: () => Promise<unknown> }).detectNow().catch((e: unknown) => app.log.error(e)); }, 5000).unref();
// Radar poll (P7.2): every 15 min by default, every minute in demo mode.
const radarEvery = Number(process.env.RADAR_INTERVAL_MS ?? (process.env.DEMO_MODE === 'true' ? 60_000 : 15 * 60_000));
setInterval(() => { (app as unknown as { pollRadar: () => Promise<unknown> }).pollRadar().catch((e: unknown) => app.log.error(e)); }, radarEvery).unref();
// v3-P0.3 retention: raw fingerprints older than the baseline window (+ margin) are deleted every 10 minutes
const keepMs = Number(process.env.FINGERPRINT_RETENTION_HOURS ?? 26) * 3600_000;
const prune = () => ingest.prune(Date.now() - keepMs).then((n) => { if (n) app.log.info({ deleted: n }, 'fingerprint retention'); }).catch((e: unknown) => app.log.error(e));
void prune();
setInterval(prune, 10 * 60_000).unref();
