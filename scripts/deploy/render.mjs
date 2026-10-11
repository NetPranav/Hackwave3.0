#!/usr/bin/env node
// `npm run deploy:render`: the Seismo engine (backend + GitHub App + demo providers, one service) and a Postgres on
// Render's free plan, created or updated through Render's API. Re-running is safe: it finds both by name, replaces the
// env vars and deploys the latest commit of the branch.
//
// Needs RENDER_API_KEY in .env (Render Dashboard -> Account Settings -> API Keys). Secrets are read from .env and sent
// to Render only; nothing is printed. Options: --branch netpranav · --region singapore · --repo <public git url>
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : dflt);
const BRANCH = opt('branch', 'netpranav');
const REGION = opt('region', 'singapore');
const REPO = opt('repo', 'https://github.com/NetPranav/Hackwave3.0');
const SERVICE = 'seismo-engine', DB = 'seismo-db';
const STATE = join(ROOT, '.seismo-online.json');
const KEY = process.env.RENDER_API_KEY;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const die = (m) => { console.error(`\n✗ ${m}\n`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!KEY) die('RENDER_API_KEY is not set in .env (Render Dashboard -> Account Settings -> API Keys -> Create API Key)');

async function render(method, path, body) {
  const r = await fetch(`https://api.render.com/v1${path}`, { method, headers: { authorization: `Bearer ${KEY}`, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`Render ${method} ${path} -> ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : undefined;
}

/** What the engine needs from .env (only the keys that are set), plus the hosted settings. */
function engineEnv(databaseUrl, sdkKeys) {
  const copy = ['AUTH_SECRET', 'INTERNAL_TOKEN', 'DEMO_ADMIN_TOKEN', 'SEISMO_PROJECT_OWNERS', 'DEMO_REPO',
    'APP_ID', 'PRIVATE_KEY', 'WEBHOOK_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_APP_SLUG',
    'NIM_API_KEY', 'NIM_BASE_URL', 'NIM_MODEL_SMART', 'NIM_MODEL_FAST', 'NIM_MODEL_EXPLAIN',
    'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM', 'TWILIO_WHATSAPP_CONTENT_SID', 'TWILIO_WHATSAPP_CONTENT_VARIABLES',
    'RESEND_API_KEY', 'EMAIL_FROM', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const vars = Object.fromEntries(copy.filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
  for (const k of ['AUTH_SECRET', 'INTERNAL_TOKEN', 'DEMO_ADMIN_TOKEN']) if (!vars[k] || /^dev-/.test(vars[k]) || vars[k].length < 24) die(`${k} in .env is empty or a default value: set a long random value first`);
  return {
    ...vars,
    NODE_ENV: 'production', DATABASE_URL: databaseUrl, DEMO_MODE: 'true', FINGERPRINT_RETENTION_HOURS: '26',
    // the engine accepts these keys besides the project keys in its database; a random one switches off 'dev-key'
    SEISMO_SDK_KEYS: sdkKeys,
    DASHBOARD_URL: process.env.DASHBOARD_URL ?? `http://localhost:${process.env.DASHBOARD_PORT ?? 3000}`,
  };
}

async function main() {
  const owners = await render('GET', '/owners?limit=20');
  const owner = (process.env.RENDER_OWNER_ID ? owners.find((o) => o.owner.id === process.env.RENDER_OWNER_ID) : owners[0])?.owner;
  if (!owner) die('no Render workspace found for this API key');
  log(`workspace: ${owner.name}`);

  // 1. Postgres (free)
  let db = (await render('GET', `/postgres?name=${DB}&ownerId=${owner.id}`))[0]?.postgres;
  if (!db) { log(`creating Postgres "${DB}" (free, ${REGION})…`); db = await render('POST', '/postgres', { name: DB, ownerId: owner.id, plan: 'free', version: '16', region: REGION }); }
  for (let i = 0; db.status !== 'available'; i++) {
    if (i > 90) die(`Postgres is still "${db.status}" after 15 minutes`);
    await sleep(10_000);
    db = (await render('GET', `/postgres?name=${DB}&ownerId=${owner.id}`))[0]?.postgres ?? db;
  }
  if (db.expiresAt) log(`Postgres ready (free plan, expires ${db.expiresAt.slice(0, 10)})`);
  const { internalConnectionString } = await render('GET', `/postgres/${db.id}/connection-info`);

  // 2. env: a random accepted SDK key (kept so re-runs don't change it) instead of the public 'dev-key'
  const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
  state.renderSdkKeys ??= `sk_render_${randomBytes(16).toString('hex')}`;
  const env = Object.entries(engineEnv(internalConnectionString, state.renderSdkKeys)).map(([key, value]) => ({ key, value: String(value) }));

  // 3. the web service (one container: backend on $PORT, providers + GitHub App behind it)
  let svc = (await render('GET', `/services?name=${SERVICE}&ownerId=${owner.id}&type=web_service`))[0]?.service;
  let deployId;
  if (!svc) {
    log(`creating web service "${SERVICE}" from ${REPO}#${BRANCH} (Docker, free, ${REGION})…`);
    const created = await render('POST', '/services', {
      type: 'web_service', name: SERVICE, ownerId: owner.id, repo: REPO, branch: BRANCH, autoDeployTrigger: 'commit', envVars: env,
      serviceDetails: { runtime: 'docker', plan: 'free', region: REGION, healthCheckPath: '/health', envSpecificDetails: { dockerfilePath: './Dockerfile', dockerContext: '.' } },
    });
    svc = created.service; deployId = created.deployId;
  } else {
    log(`updating "${SERVICE}" env and deploying the latest commit…`);
    await render('PUT', `/services/${svc.id}/env-vars`, env);
    deployId = (await render('POST', `/services/${svc.id}/deploys`, {}))?.id;
  }
  const url = svc.serviceDetails?.url;
  log(`service ${svc.dashboardUrl}`);

  // 4. wait for the deploy (Docker build ~3-6 min on the free plan)
  let status = 'created';
  for (let i = 0; !['live', 'build_failed', 'update_failed', 'canceled', 'pre_deploy_failed', 'deactivated'].includes(status); i++) {
    if (i > 120) die('the deploy did not finish in 20 minutes: see the service logs in the Render dashboard');
    await sleep(10_000);
    const list = await render('GET', `/services/${svc.id}/deploys?limit=1`);
    const d = deployId ? (await render('GET', `/services/${svc.id}/deploys/${deployId}`).catch(() => undefined)) ?? list[0]?.deploy : list[0]?.deploy;
    if (d?.status && d.status !== status) { status = d.status; log(`deploy: ${status}`); }
  }
  if (status !== 'live') die(`deploy ${status}: open ${svc.dashboardUrl} -> Logs`);
  const health = await fetch(`${url}/health`, { signal: AbortSignal.timeout(60_000) }).then((r) => r.status).catch(() => 0);
  state.engineUrl = url;
  writeFileSync(STATE, JSON.stringify(state, null, 2), { mode: 0o600 });
  log(health === 200 ? `✓ engine live: ${url}` : `⚠ engine deployed but ${url}/health answered ${health}`);
  // the keep-alive workflow (.github/workflows/keepalive.yml) pings this URL every 10 minutes
  try { execFileSync('gh', ['variable', 'set', 'SEISMO_ENGINE_URL', '--body', url, '-R', REPO.replace('https://github.com/', '')], { stdio: 'ignore' }); log('keep-alive: repo variable SEISMO_ENGINE_URL set'); }
  catch { log('⚠ could not set the repo variable SEISMO_ENGINE_URL (gh): set it by hand for the keep-alive workflow'); }
  console.log(`\nNext:\n  npm run demo:online -- --hosted        point the hosted shop at the engine (once, no tunnels)\n  npm run github:webhook -- --to hosted  GitHub App events go to the engine (stop npm run dev's engine first)\n  SEISMO_ENGINE_URL=${url} npm run dev   your local dashboard on the hosted engine\n`);
}

main().catch((e) => die(e.message));
