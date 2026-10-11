#!/usr/bin/env node
// `npm run demo:online`: put the demo shop online (Vercel) against THIS machine's Seismo stack, so the whole loop is live:
//   change a provider in the live shop's panel -> live shop breaks -> Seismo (here) detects it -> fix PR on GitHub
//   -> you merge it -> Vercel rebuilds the shop from main -> the live shop works again. No manual pull anywhere.
//
// Steps (each one checked; it stops with a clear message if one fails):
//   1. refuses default INTERNAL_TOKEN / DEMO_ADMIN_TOKEN (the tunnel makes this machine reachable from the internet)
//   2. opens two Cloudflare quick tunnels: the Seismo backend (:4000) and the fake providers (:4100), and pings both
//   3. a real SDK key for the hosted shop (created once via the API, reused while valid) and a fixed salt
//   4. writes the URLs + key into the Vercel project's Production and Preview env, redeploys Production from git
//   5. finds the deployment's public alias by pinging its aliases, registers it with Seismo (the dashboard links to it)
//      and sets it as the GitHub repo's homepage (so it is found again after a restart)
// Keep it running: the tunnels live as long as this process. Ctrl-C closes them (the hosted shop then can't reach
// the providers; the dashboard falls back to the local shop by itself).
//
// Needs: npm run dev running, cloudflared, the Vercel CLI logged in and linked in the shop folder (vercel link),
// gh logged in. Options: --shop-dir ../seismo-demo-shop · --no-homepage · --no-redeploy
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Resolver } from 'node:dns/promises';
import https from 'node:https';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : dflt);
const SHOP_DIR = resolve(ROOT, opt('shop-dir', process.env.SHOP_DIR ?? '../seismo-demo-shop'));
const BACKEND = `http://localhost:${process.env.PORT ?? 4000}`;
const PROVIDERS = `http://localhost:${process.env.SERVICES_PORT ?? 4100}`;
const DASHBOARD = process.env.DASHBOARD_URL ?? `http://localhost:${process.env.DASHBOARD_PORT ?? 3000}`;
const STATE = join(ROOT, '.seismo-online.json');   // git-ignored: the hosted shop's SDK key + salt
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const die = (msg) => { console.error(`\n✗ ${msg}\n`); cleanup(); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const children = [];
function cleanup() { for (const c of children) try { c.kill(); } catch { /* gone */ } }
process.on('SIGINT', () => { log('closing the tunnels'); cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

const ok = async (url, init) => { try { const r = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) }); return r.ok ? r : undefined; } catch { return undefined; } };
function bearer(login) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const h = b({ alg: 'HS256', typ: 'JWT' }), p = b({ sub: login, iat: now, exp: now + 300 });
  return `${h}.${p}.${createHmac('sha256', process.env.AUTH_SECRET).update(`${h}.${p}`).digest('base64url')}`;
}
const vercelJson = (argv) => { const r = spawnSync('vercel', argv, { cwd: SHOP_DIR, encoding: 'utf8', timeout: 120_000 }); if (r.status !== 0) die(`vercel ${argv.join(' ')}: ${r.stderr.trim().split('\n').pop()}`); return JSON.parse(r.stdout); };
// stdout + stderr: some commands (inspect) print their details on stderr
function vercel(argv) {
  const r = spawnSync('vercel', argv, { cwd: SHOP_DIR, encoding: 'utf8', timeout: 600_000 });
  if (r.status !== 0) throw Object.assign(new Error(`vercel ${argv[0]} failed`), { stderr: r.stderr });
  return `${r.stdout}\n${r.stderr}`;
}

/** A Cloudflare quick tunnel to a local port; resolves with its public https URL once it answers. */
function tunnel(port, label) {
  return new Promise((resolveUrl, reject) => {
    const c = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(c);
    let found = false, url;
    // the URL is printed first; it only routes once a connection is registered
    const scan = (buf) => {
      const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(buf));
      if (m) url ??= m[0];
      if (url && !found && /Registered tunnel connection/.test(String(buf))) { found = true; resolveUrl(url); }
    };
    c.stdout.on('data', scan); c.stderr.on('data', scan);
    c.on('exit', (code) => { if (!found) reject(new Error(`cloudflared (${label}) exited with ${code}`)); else log(`⚠ tunnel for ${label} closed`); });
    setTimeout(() => { if (!found) reject(new Error(`no tunnel URL for ${label} after 45 s`)); }, 45_000);
  });
}
/**
 * A brand-new tunnel hostname: asking the system resolver too early makes macOS cache "no such host" for a while, so
 * the check resolves through Cloudflare's DNS (1.1.1.1) and connects to that address directly.
 */
const cfDns = new Resolver(); cfDns.setServers(['1.1.1.1', '1.0.0.1']);
function probe(url) {
  return new Promise((done) => {
    // Node asks for every address ({ all: true }) when it may try several (happy eyeballs)
    const lookup = (host, o, cb) => cfDns.resolve4(host).then((a) => (o?.all ? cb(null, a.map((address) => ({ address, family: 4 }))) : cb(null, a[0], 4)), (e) => cb(e));
    const req = https.get(url, { timeout: 8000, lookup }, (r) => { r.resume(); done(r.statusCode === 200); });
    req.on('timeout', () => req.destroy()); req.on('error', () => done(false));
  });
}
async function untilAnswers(url, what) {
  for (let i = 0; i < 60; i++) { if (await probe(url)) return; await sleep(2000); }
  die(`${what} does not answer at ${url} (2 minutes)`);
}

async function main() {
  // 1. safety: this machine becomes reachable from the internet
  for (const k of ['AUTH_SECRET', 'INTERNAL_TOKEN', 'DEMO_ADMIN_TOKEN']) {
    const v = process.env[k] ?? '';
    if (!v || /^dev-/.test(v) || v.length < 24) die(`${k} in .env is empty or a default value. Set a long random value (e.g. \`openssl rand -hex 24\`), restart npm run dev, then run this again.`);
  }
  if (!existsSync(join(SHOP_DIR, '.vercel', 'project.json'))) die(`${SHOP_DIR} is not linked to a Vercel project: run \`vercel link\` there once.`);
  if (!(await ok(`${BACKEND}/health`))) die(`the Seismo backend is not running at ${BACKEND}: start npm run dev first.`);
  if (!(await ok(`${PROVIDERS}/health`))) die(`the fake providers are not running at ${PROVIDERS}: start npm run dev first.`);

  // 2. public URLs for this machine
  log('opening tunnels (Cloudflare quick tunnels, no account needed)…');
  const [pubBackend, pubProviders] = await Promise.all([tunnel(new URL(BACKEND).port, 'backend'), tunnel(new URL(PROVIDERS).port, 'providers')]).catch((e) => die(e.message));
  await untilAnswers(`${pubBackend}/health`, 'the backend tunnel');
  await untilAnswers(`${pubProviders}/health`, 'the providers tunnel');
  log(`backend   ${pubBackend}`);
  log(`providers ${pubProviders}`);

  // 3. SDK key for the hosted shop (a real project key, not dev-key) + a salt that is the same on every instance
  const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
  const keyWorks = state.key && (await ok(`${BACKEND}/v1/sdk/readiness`, { headers: { 'x-seismo-key': state.key } }));
  if (!keyWorks) {
    const login = (process.env.SEISMO_PROJECT_OWNERS ?? '').split(',')[0] || process.env.VERIFY_LOGIN;
    if (!login) die('set SEISMO_PROJECT_OWNERS in .env (your GitHub login) so a project key can be created');
    const auth = { authorization: `Bearer ${bearer(login)}`, 'content-type': 'application/json' };
    const projects = await (await ok(`${BACKEND}/v1/projects`, { headers: auth }))?.json();
    if (!projects?.[0]) die(`could not list projects as ${login} (owner only)`);
    const r = await ok(`${BACKEND}/v1/projects/${encodeURIComponent(projects[0].id)}/keys`, { method: 'POST', headers: auth, body: JSON.stringify({ name: 'hosted demo shop' }) });
    state.key = (await r?.json())?.key;
    if (!state.key) die('could not create an SDK key');
    log('created an SDK key for the hosted shop');
  }
  state.salt ??= randomBytes(16).toString('hex');
  writeFileSync(STATE, JSON.stringify(state, null, 2), { mode: 0o600 });

  // 4. Vercel env (Production + Preview), then a fresh Production build from git
  const env = {
    USERS_API_URL: pubProviders, PAYMENTS_API_URL: pubProviders, SHIPPING_API_URL: pubProviders, ORDERS_API_URL: pubProviders,
    SEISMO_ENDPOINT: pubBackend, SEISMO_KEY: state.key, SEISMO_SALT: state.salt, SEISMO_SAMPLE_RATE: '1',
    DEMO_PANEL: 'true', DEMO_ADMIN_TOKEN: process.env.DEMO_ADMIN_TOKEN, NEXT_PUBLIC_SEISMO_DASHBOARD_URL: DASHBOARD,
  };
  const secret = new Set(['SEISMO_KEY', 'SEISMO_SALT', 'DEMO_ADMIN_TOKEN']);
  log('writing the env into the Vercel project (production + preview)…');
  for (const [name, value] of Object.entries(env)) for (const target of ['production', 'preview']) {
    try { vercel(['env', 'add', name, target, '--value', value, '--force', ...(secret.has(name) ? ['--sensitive'] : ['--no-sensitive']), '--yes']); }
    catch (e) { die(`vercel env add ${name} ${target} failed: ${String(e.stderr ?? e.message).trim().split('\n').pop()}`); }
  }
  let deployment;
  if (!args.includes('--no-redeploy')) {
    const list = vercelJson(['ls', '--prod', '--format', 'json']);
    const latest = list.deployments?.find((d) => d.target === 'production');
    if (!latest) die('no production deployment yet: push the shop to main once (Vercel builds it), then run this again');
    log(`rebuilding production from git (${latest.url})… about a minute`);
    const out = vercel(['redeploy', `https://${latest.url}`, '--target', 'production']);
    deployment = /https:\/\/[^\s]+\.vercel\.app/.exec(out)?.[0];
    if (!deployment) die(`could not read the new deployment URL from: ${out.slice(-300)}`);
    vercel(['inspect', deployment, '--wait', '--timeout', '5m']);
  } else {
    const list = vercelJson(['ls', '--prod', '--format', 'json']);
    deployment = `https://${list.deployments?.find((d) => d.target === 'production')?.url}`;
  }

  // 5. its public address: the first alias that answers 200 (per-deployment URLs sit behind Vercel's login)
  const aliases = [...vercel(['inspect', deployment]).matchAll(/https:\/\/[a-z0-9.-]+\.vercel\.app/g)].map((m) => m[0]).filter((u, i, a) => a.indexOf(u) === i && u !== deployment);
  let shop;
  for (const a of [...aliases].sort((x, y) => x.length - y.length)) {
    const r = await fetch(a, { redirect: 'manual', signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
    if (r?.status === 200) { shop = a; break; }
  }
  if (!shop) die(`none of the deployment's aliases is public (${aliases.join(', ')}): turn off Vercel Authentication for Production or add a domain`);
  // the hosted shop really talks to this machine: the checkout makes provider calls through the tunnel
  const checkout = await ok(`${shop}/checkout`);
  log(checkout ? `✓ ${shop}/checkout works through the tunnels` : `⚠ ${shop}/checkout did not answer 200 (check the shop's Vercel logs)`);
  await fetch(`${BACKEND}/internal/demo/shop`, { method: 'POST', headers: { 'x-internal-token': process.env.INTERNAL_TOKEN, 'content-type': 'application/json' }, body: JSON.stringify({ url: shop }) }).catch(() => undefined);
  if (!args.includes('--no-homepage')) {
    const repo = JSON.parse(execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner,homepageUrl'], { cwd: SHOP_DIR, encoding: 'utf8' }));
    if (repo.homepageUrl !== shop) { execFileSync('gh', ['repo', 'edit', repo.nameWithOwner, '--homepage', shop], { cwd: SHOP_DIR }); log(`set ${repo.nameWithOwner}'s homepage to ${shop}`); }
  }

  console.log(`
  ┌─────────────────────────────────────────────────────────────────────
  │ Live shop:  ${shop}
  │ Seismo:     ${DASHBOARD}/app   (this machine)
  │ Traffic:    npm run demo:traffic -- --shop --target ${shop} --rps 1
  │
  │ Change a provider in the live shop's panel (bottom-right), watch the dashboard,
  │ merge the fix PR: Vercel rebuilds the shop from main and the live shop works again.
  │ Keep this running (the tunnels close with it). Ctrl-C to stop.
  └─────────────────────────────────────────────────────────────────────`);
  // stay alive; say so if a tunnel stops answering
  for (;;) {
    await sleep(30_000);
    if (!(await ok(`${pubBackend}/health`)) || !(await ok(`${pubProviders}/health`))) log('⚠ a tunnel stopped answering: restart npm run demo:online');
  }
}

main().catch((e) => die(e.stack ?? String(e)));
