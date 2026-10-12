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
// Fingerprints stay in memory (never written to the database) unless SEISMO_FINGERPRINTS=postgres is set.
const fpInPg = pg && process.env.SEISMO_FINGERPRINTS === 'postgres';
const ingest = fpInPg ? pgIngest() : memoryIngest();
// clean up what the old behaviour stored: the fingerprints table is emptied once at start-up
if (pg && !fpInPg) await pgIngest().prune(Date.now() + 365 * 86_400_000).then((n) => { if (n) console.log(`removed ${n} stored fingerprints (they are kept in memory now)`); }).catch(() => undefined);
const engine = new DriftEngine(ingest, () => store.all(), undefined, httpFixDispatcher(), pg ? pgEvents() : undefined);
await engine.init();   // remembered events are visible before the first detection pass
const keys = new SdkKeys();
if (pg) await keys.attach(pgKeys());
const app = buildApp({ store, ingest, engine, keys, settings: pg ? pgSettings() : undefined, installations: httpInstallations(), github: httpGithubApp(), ...(pg ? { projects: new Projects(pgOwners()) } : {}) });
await app.listen({ port, host: '0.0.0.0' });
// Detection pass every 5 s (P4.2). Errors must never kill the API.
setInterval(() => { (app as unknown as { detectNow: () => Promise<unknown> }).detectNow().catch((e: unknown) => app.log.error(e)); }, Number(process.env.SEISMO_DETECT_INTERVAL_MS ?? 5000)).unref();
// Radar poll (P7.2): every 15 min by default, every minute in demo mode.
const radarEvery = Number(process.env.RADAR_INTERVAL_MS ?? (process.env.DEMO_MODE === 'true' ? 60_000 : 15 * 60_000));
setInterval(() => { (app as unknown as { pollRadar: () => Promise<unknown> }).pollRadar().catch((e: unknown) => app.log.error(e)); }, radarEvery).unref();
// v3-P0.3 retention: fingerprints older than the baseline window (+ margin) are dropped every minute
// in memory only the last 30 minutes are needed: the engine keeps its own 10 s rollups for the whole baseline and
// re-reads just the last 10 minutes each pass
const keepMs = fpInPg ? Number(process.env.FINGERPRINT_RETENTION_HOURS ?? 26) * 3600_000 : 30 * 60_000;
const prune = () => ingest.prune(Date.now() - keepMs).then((n) => { if (n) app.log.info({ deleted: n }, 'fingerprint retention'); }).catch((e: unknown) => app.log.error(e));
void prune();
setInterval(prune, 60_000).unref();
