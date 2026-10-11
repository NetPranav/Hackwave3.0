#!/usr/bin/env node
// End-to-end verification of the whole pipeline, in a VISIBLE browser (Brave or Chrome), against the running local stack:
//   shop demo panel (real clicks) -> fake provider changes -> shop traffic -> SDK -> backend detectors -> dashboard UI
//   -> fix rule / PR -> self-heal in the shop -> provider reverts -> resolved.
// For every change it records when it was applied, when the engine first saw it, when it was confirmed, when it
// appeared in the dashboard, when a fix/PR was ready and when the shop healed; what was expected vs what was flagged
// (extra events = false alarms); and an ORACLE check: the proposed rule applied to the changed provider response must
// give back exactly the value the unchanged provider returned. Results: docs/verification/pipeline-run-<date>.md (+ .json).
//
// Needs: npm run dev (backend :4000, providers :4100, dashboard :3000) + the shop (npm run dev:live, :3100) + traffic
// (npm run demo:traffic -- --shop --rps 2). Run:  node --env-file=.env scripts/verify/pipeline.mjs [--only rename,scale] [--skip-reset]
import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { applyAliases, applyTransforms } from '../../sdk-node/dist/runtime.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BACKEND = process.env.VERIFY_BACKEND ?? 'http://localhost:4000';
const PROVIDERS = process.env.VERIFY_PROVIDERS ?? 'http://localhost:4100';
const DASH = process.env.VERIFY_DASHBOARD ?? 'http://localhost:3000';
const SHOP = process.env.VERIFY_SHOP ?? 'http://localhost:3100';
const ADMIN = process.env.DEMO_ADMIN_TOKEN ?? 'dev-admin';
const INTERNAL = process.env.INTERNAL_TOKEN ?? 'dev-internal';
const SECRET = process.env.AUTH_SECRET;
const LOGIN = process.env.VERIFY_LOGIN ?? (process.env.SEISMO_PROJECT_OWNERS ?? 'NetPranav').split(',')[0];
const args = process.argv.slice(2);
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const SKIP_RESET = args.includes('--skip-reset');
const DATE = new Date().toISOString().slice(0, 10) + (/localhost|127\.0\.0\.1/.test(process.env.VERIFY_SHOP ?? 'localhost') ? '' : '-live');
const OUT = join(ROOT, 'docs', 'verification');
const SHOTS = join(OUT, 'screens');
if (!SECRET) { console.error('AUTH_SECRET missing: run with node --env-file=.env'); process.exit(1); }

// ---------------------------------------------------------------------------------------------------------------
// the changes to make, and what a correct Seismo does about each

const SCENARIOS = [
  { id: 'rename', panel: { service: 'users', kind: 'rename', field: 'name', input: 'customer_name' }, sample: 'users',
    expect: { detector: 'D3', field: 'name', fix: 'alias PR + self-heal' }, check: { field: 'name' } },
  { id: 'scale', panel: { service: 'payments', kind: 'scale', field: 'amount', input: '100' }, sample: 'payments',
    expect: { detector: 'D5', field: 'amount', fix: 'scale rule (review)' }, check: { field: 'amount' } },
  { id: 'type', panel: { service: 'orders', kind: 'type', field: 'total_rupees', input: 'string' }, sample: 'orders',
    expect: { detector: 'D4', field: 'data[].total_rupees', fix: 'coerce rule (review)' }, check: { field: 'total_rupees', list: 'data' } },
  { id: 'value', panel: { service: 'shipping', kind: 'value', field: 'status', input: 'lost' }, sample: 'shipping',
    expect: { detector: 'D7', field: 'status', fix: 'review; a map rule only for a spelling variant, never a new meaning' }, check: { field: 'status', semantic: true } },
  { id: 'remove', panel: { service: 'users', kind: 'remove', field: 'email', input: '' }, sample: 'users',
    expect: { detector: 'D1', field: 'email', fix: 'none (code change, review)' }, check: null },
  { id: 'cap', panel: { service: 'orders', kind: 'cap', field: 'data', input: '2' }, sample: 'orders',
    expect: { detector: 'D9', field: 'data', fix: 'none (code change, review)' }, check: null },
].filter((s) => !ONLY || ONLY.includes(s.id));
const OPEN_PR_FOR = new Set((process.env.VERIFY_OPEN_PR ?? '').split(',').filter(Boolean));
const ORDER = ['rename', 'scale', 'type', 'value', 'remove', 'cap'];

// ---------------------------------------------------------------------------------------------------------------
// plumbing

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t = () => Date.now();
const secs = (ms) => (ms === undefined || ms === null ? '—' : `${Math.round(ms / 100) / 10} s`);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function bearer() {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(t() / 1000);
  const h = b({ alg: 'HS256', typ: 'JWT' }), p = b({ sub: LOGIN, iat: now, exp: now + 300 });
  return `${h}.${p}.${createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`;
}
async function api(path, init = {}) {
  const r = await fetch(`${BACKEND}${path}`, { ...init, headers: { authorization: `Bearer ${bearer()}`, 'content-type': 'application/json', ...init.headers } });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}
const admin = (path, init = {}) => fetch(`${PROVIDERS}${path}`, { ...init, headers: { 'x-admin-token': ADMIN, 'content-type': 'application/json', ...init.headers } });

/** The same request the shop makes, straight to the provider: the "before" and "after" of the oracle. */
async function providerSample(service) {
  const get = (p) => fetch(`${PROVIDERS}${p}`).then((r) => r.json());
  if (service === 'users') return { endpoint: 'GET /users/{id}', body: await get('/users/u_1') };
  if (service === 'shipping') return { endpoint: 'GET /shipments/{id}', body: await get('/shipments/sh_1') };
  if (service === 'orders') return { endpoint: 'GET /orders', body: await get('/orders?limit=5') };
  const body = await fetch(`${PROVIDERS}/payments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ order_id: 'ord_verify', rupees: 499 }) }).then((r) => r.json());
  return { endpoint: 'POST /payments', body };
}

const valueAt = (body, check) => (check.list ? (body?.[check.list] ?? []).map((r) => r?.[check.field]) : body?.[check.field]);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Apply the proposed rule exactly like the customer's withAliases() does, then compare with the unchanged provider. */
function oracle(rule, before, after, check) {
  if (!rule) return { verdict: 'no rule', detail: 'no data rule proposed' };
  const rules = [rule];
  const fixed = applyTransforms(applyAliases(after.body, rules.filter((r) => !r.kind || r.kind === 'alias'), after.endpoint), rules, after.endpoint);
  const want = valueAt(before.body, check), got = valueAt(fixed, check), broken = valueAt(after.body, check);
  if (check.semantic) return { verdict: 'needs a human', detail: `rule maps ${JSON.stringify(broken)} -> ${JSON.stringify(got)}; the unchanged provider said ${JSON.stringify(want)} (meaning cannot be proven by data)` };
  // nothing else in the response may change
  const others = Object.keys(after.body ?? {}).filter((k) => k !== check.field && k !== check.list && !same(after.body[k], fixed?.[k]));
  return same(want, got) && !others.length
    ? { verdict: 'PASS', detail: `restored ${check.field} = ${JSON.stringify(got)} (provider before the change: ${JSON.stringify(want)})` }
    : { verdict: 'FAIL', detail: `got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}${others.length ? `; also changed: ${others.join(', ')}` : ''}` };
}

// ---------------------------------------------------------------------------------------------------------------
// browser

async function sessionCookie() {
  const { encode } = await import(join(ROOT, 'dashboard', 'node_modules', '@auth', 'core', 'jwt.js'));
  const value = await encode({ token: { name: LOGIN, login: LOGIN, sub: LOGIN }, secret: SECRET, salt: 'authjs.session-token', maxAge: 8 * 3600 });
  return { name: 'authjs.session-token', value, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' };
}

function browserPath() {
  const candidates = [process.env.VERIFY_BROWSER, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'];
  return candidates.find((p) => p && existsSync(p));
}

async function openPanel(shop) {
  if (await shop.locator('select[aria-label="Provider"]').count()) return;
  await shop.locator('.demo-fab').click();
  await shop.locator('select[aria-label="Provider"]').waitFor({ timeout: 15_000 });
}

const INPUT_LABEL = { rename: 'New name', scale: 'Factor', value: 'Value', cap: 'Max items' };

async function applyInPanel(shop, c) {
  await openPanel(shop);
  await shop.selectOption('select[aria-label="Provider"]', c.service);
  await shop.selectOption('select[aria-label="Kind of change"]', c.kind);
  await shop.fill('input[aria-label="Field"]', c.field);
  if (c.kind === 'type') await shop.selectOption('select[aria-label="New type"]', c.input);
  else if (c.input) await shop.fill(`input[aria-label="${INPUT_LABEL[c.kind]}"]`, c.input);
  await shop.getByRole('button', { name: 'Apply' }).click();
}

/** Undo only the changes this run made (someone else may be testing on the same providers). */
const mine = new Set();
async function undoMine() {
  const left = await admin('/admin/custom').then((r) => r.json());
  for (const c of left) if (mine.has(c.id)) await admin(`/admin/custom/${c.id}`, { method: 'DELETE' });
  mine.clear();
}

// ---------------------------------------------------------------------------------------------------------------
// phases

async function localReset() {
  // providers back to v1 + Seismo's data cleared. The GitHub repo is NOT touched (merged fix rules stay).
  // Never on top of someone else's test: a change made in a shop panel (local or hosted) means stop.
  const active = await admin('/admin/custom').then((r) => r.json()).catch(() => []);
  const flipped = Object.entries(await admin('/admin/scenarios').then((r) => r.json()).catch(() => ({}))).filter(([, v]) => v?.enabled);
  if (active.length || flipped.length) throw new Error(`someone is testing: ${active.length} panel change(s) and ${flipped.length} scenario(s) are on. Turn them off (shop panel → undo / Turn all changes off) and run again.`);
  await admin('/admin/reset', { method: 'POST', body: '{}' });
  const r = await fetch(`${BACKEND}/internal/demo/reset`, { method: 'POST', headers: { 'x-internal-token': INTERNAL, 'content-type': 'application/json' }, body: '{}' });
  if (!r.ok) throw new Error(`engine reset -> ${r.status}`);
}

async function learning(maxMs = 10 * 60_000) {
  const start = t(), readyAt = {};
  log('learning: waiting until every endpoint has a baseline');
  // a detection pass that started before the reset can still report the old numbers: start counting after 2 fresh passes
  await sleep(12_000);
  while (t() - start < maxMs) {
    const rows = await api('/v1/readiness').catch(() => []);
    for (const r of rows) if (r.ready && !readyAt[r.endpoint]) { readyAt[r.endpoint] = t() - start; log(`  ready: ${r.endpoint} after ${secs(readyAt[r.endpoint])} (${r.samples}/${r.needed} samples)`); }
    if (rows.length >= 4 && rows.every((r) => r.ready)) break;
    await sleep(2000);
  }
  return readyAt;
}

const SAMPLE_ENDPOINT = { users: 'GET /users/{id}', payments: 'POST /payments', shipping: 'GET /shipments/{id}', orders: 'GET /orders' };
// the change is judged on the endpoint the oracle samples; the same change seen on another endpoint of that provider is reported as 'also flagged'
const matches = (e, s) => e.endpoint === SAMPLE_ENDPOINT[s.sample] && e.detector === s.expect.detector && (e.field === s.expect.field || e.field?.endsWith(`.${s.expect.field}`) || e.field?.endsWith(`]${s.expect.field}`) || (s.expect.field && e.title.includes(s.expect.field)));

async function runScenario(s, dash, shop) {
  const known = new Set((await api('/v1/drift-events')).map((e) => e.id));
  const before = await providerSample(s.sample);
  log(`▶ ${s.id}: ${s.panel.service} ${s.panel.kind} ${s.panel.field} ${s.panel.input}`);
  await dash.goto(`${DASH}/app/timeline`, { waitUntil: 'domcontentloaded' });
  const t0 = t();
  const had = new Set((await admin('/admin/custom').then((r) => r.json())).map((c) => c.id));
  await applyInPanel(shop, s.panel);
  await sleep(500);
  for (const c of await admin('/admin/custom').then((r) => r.json())) if (!had.has(c.id)) mine.add(c.id);
  await sleep(1500);
  const after = await providerSample(s.sample);
  const applied = !same(valueAt(before.body, s.check ?? { field: s.panel.field }), valueAt(after.body, s.check ?? { field: s.panel.field })) || s.id === 'remove' || s.id === 'cap';
  const r = { id: s.id, change: `${s.panel.service}: ${s.panel.kind} ${s.panel.field}${s.panel.input ? ` → ${s.panel.input}` : ''}`, expected: s.expect, applied, states: [], t: {} };
  let ev, extra = new Map(), also = new Map(), uiSeen = false;
  const deadline = t0 + 5 * 60_000;
  while (t() < deadline) {
    const events = (await api('/v1/drift-events')).filter((e) => !known.has(e.id));
    for (const e of events) {
      if (matches(e, s)) continue;
      if (e.service === s.panel.service && e.detector === s.expect.detector) also.set(e.id, `${e.endpoint}: ${e.title}`);
      else extra.set(e.id, `${e.detector} ${e.state}: ${e.title}`);
    }
    const cur = events.find((e) => matches(e, s));
    if (cur) {
      ev = cur;
      r.t.firstSeen ??= t() - t0;
      if (r.states.at(-1)?.state !== cur.state) r.states.push({ state: cur.state, at: t() - t0 });
      // confirmed = still found 2 passes (≥ 10 s) after first seen; a warning-level change stays 'suspected' when confirmed
      if (['breaking', 'fix_pending'].includes(cur.state) || t() - t0 - r.t.firstSeen >= 10_000) r.t.confirmed ??= t() - t0;
      if (cur.fix?.validation?.prUrl) { r.t.pr ??= t() - t0; r.prUrl = cur.fix.validation.prUrl; }
      if (cur.heal?.hits > 0) r.t.healed ??= t() - t0;
      // review-only fixes (type, unit): press "Open fix PR (stress-tested)" like a person would, once it is confirmed
      if (OPEN_PR_FOR.has(s.id) && r.t.confirmed !== undefined && !r.t.prPressed) {
        r.t.prPressed = t() - t0;
        const item = (await api('/v1/review')).find((i) => i.drift.id === cur.id && i.proposedRule);
        if (item) {
          const res = await api('/v1/review', { method: 'POST', body: JSON.stringify({ id: item.id, action: 'open_pr' }) }).catch((e) => ({ error: e.message }));
          if (res.prUrl) { r.t.pr = t() - t0; r.prUrl = res.prUrl; } else r.prError = res.error ?? 'no PR';
        } else r.prError = 'no proposed rule in the review queue';
      }
      if (!uiSeen) {
        const text = await dash.locator('body').innerText().catch(() => '');
        if (text.includes(cur.title) || (cur.field && text.includes(cur.title.split(':')[0]) && text.includes(s.panel.field))) { uiSeen = true; r.t.dashboard = t() - t0; await dash.screenshot({ path: join(SHOTS, `${s.id}-dashboard.png`) }); }
        else if ((t() - t0) % 20_000 < 2000) await dash.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
      }
    }
    // a rename is done when the shop healed (self-heal on) or 45 s after its PR opened (self-heal off: the PR is the fix)
    const fixReady = s.id === 'rename' ? r.t.healed !== undefined || (r.t.pr !== undefined && t() - t0 > r.t.pr + 45_000) : r.t.confirmed !== undefined;
    if (ev && uiSeen && fixReady && t() - t0 > (r.t.confirmed ?? 0) + 15_000) break;
    await sleep(2000);
  }
  r.alsoFlagged = [...also.values()];
  r.event = ev ? { id: ev.id, detector: ev.detector, field: ev.field, title: ev.title, state: ev.state, severity: ev.severity, usages: ev.usages.length } : null;
  // events closed as explained by the main finding (D1/D2 by a rename, D6 by a unit change) are one story, not false alarms
  r.falseAlarms = [...extra.values()].filter((x) => !x.includes('(explained:') && !(s.id === 'rename' && /D1|D2/.test(x) && x.includes(s.panel.field)));
  // the rule Seismo proposes (alias: on the event; transforms: in the review queue), checked against reality
  const reviewItem = ev ? (await api('/v1/review')).find((i) => i.drift.id === ev.id) : undefined;
  r.review = reviewItem ? { suggestion: reviewItem.suggestion?.slice(0, 160), reason: reviewItem.reason } : undefined;
  const rule = ev?.fix?.rule ?? reviewItem?.proposedRule;
  r.rule = rule ?? null;
  r.oracle = s.check ? oracle(rule, before, after, s.check) : { verdict: 'n/a', detail: 'no data rule can fix this kind of change: review with a suggestion is the right outcome' };
  if (s.id === 'rename') {
    // the shop page itself: does the checkout show the name again (healed) while the provider still sends customer_name?
    await shop.goto(`${SHOP}/checkout`, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
    const text = await shop.locator('body').innerText().catch(() => '');
    r.shopShowsName = !/name missing/i.test(text);
    await shop.screenshot({ path: join(SHOTS, `${s.id}-shop-checkout.png`) });
    await shop.goto(SHOP, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
  }
  // provider goes back to normal -> the change must resolve by itself
  const tUndo = t();
  await undoMine();
  while (ev && t() - tUndo < 3 * 60_000) {
    const e = (await api('/v1/drift-events')).find((x) => x.id === ev.id);
    if (!e || e.state === 'resolved') { r.t.resolvedAfterUndo = t() - tUndo; break; }
    await sleep(2000);
  }
  log(`  ${s.id}: first ${secs(r.t.firstSeen)} · confirmed ${secs(r.t.confirmed)} · dashboard ${secs(r.t.dashboard)} · PR ${secs(r.t.pr)} · healed ${secs(r.t.healed)} · resolved ${secs(r.t.resolvedAfterUndo)} · oracle ${r.oracle.verdict} · extra ${r.falseAlarms.length}`);
  await sleep(20_000);   // let the reverted traffic settle before the next change
  return r;
}

/** Every screen once: loads, no error overlay, no console errors, something on it. */
async function screens(ctx) {
  const pages = [
    ...['/', '/login', '/docs/sdk', '/onboarding', '/app', '/app/status', '/app/status/users', '/app/timeline', '/app/graph', '/app/fixes', '/app/review', '/app/compare', '/app/radar', '/app/settings', '/app/demo'].map((p) => DASH + p),
    ...['/', '/checkout', '/orders', '/invoice'].map((p) => SHOP + p),
  ];
  const out = [];
  for (const url of pages) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Download the React DevTools|ERR_ABORTED|hydrat/i.test(m.text())) errors.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));
    const t0 = t();
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 }).catch((e) => ({ status: () => `ERR ${e.message.slice(0, 60)}` }));
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    const text = await page.locator('body').innerText().catch(() => '');
    // Next.js's real error dialog (inside its shadow root; Playwright's css pierces it), not the "N" dev badge
    const overlay = await page.locator('[data-nextjs-dialog], [data-nextjs-error-overlay]').count().catch(() => 0);
    const name = url.replace(/^https?:\/\/localhost:/, '').replace(/[/:]/g, '_') || 'root';
    await page.screenshot({ path: join(SHOTS, `page${name}.png`), fullPage: false }).catch(() => undefined);
    out.push({ url, status: res?.status?.(), ms: t() - t0, chars: text.length, errorOverlay: overlay > 0, consoleErrors: errors.slice(0, 3) });
    await page.close();
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// report

function report(run) {
  const L = [];
  L.push(`# Pipeline verification run · ${run.date}`, '');
  L.push(`Generated by \`scripts/verify/pipeline.mjs\` in a visible browser (${run.browser}). Every change below was made by clicking the shop's demo panel; nothing was injected into Seismo.`, '');
  L.push('## Timing model (from the code)', '');
  L.push('| Step | Time |', '|---|---|');
  L.push('| SDK sends one fingerprint per endpoint | every 5 s |', '| Detection pass | every 5 s |', '| Window compared with the baseline | last 60 s (a change must fill ≥ 95% of it) |');
  L.push('| Confirmation | 2 passes in a row |', '| Learning: baseline before changes count | 50 responses per endpoint, older than the 60 s window |', '| SDK fetches live (self-heal) rules | every 30 s |');
  L.push(`| **Expected worst case, change → confirmed** | **≈ 5 + 60 + 5 + 5 = 75 s** (+ up to 30 s for self-heal) |`, '');
  L.push('## Learning time (after a reset, with traffic running)', '');
  L.push('| Endpoint | Ready after |', '|---|---|');
  for (const [ep, ms] of Object.entries(run.learning)) L.push(`| ${ep} | ${secs(ms)} |`);
  L.push('', '## Changes made vs what Seismo flagged', '');
  L.push('| Change (panel) | Expected | Flagged | First seen | Confirmed | On dashboard | PR | Shop healed | Resolved after undo | Fix check (oracle) | False alarms |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of run.results) {
    const flagged = (r.event ? `${r.event.detector} · ${r.event.title} · ${r.event.state}` : '**not flagged**') + (r.alsoFlagged?.length ? ` (same change also on: ${r.alsoFlagged.join('; ')})` : '');
    L.push(`| ${r.change}${r.rerun ? ' (re-run)' : ''} | ${r.expected.detector} · ${r.expected.fix} | ${flagged} | ${secs(r.t.firstSeen)} | ${secs(r.t.confirmed)} | ${secs(r.t.dashboard)} | ${r.prUrl ? `[${secs(r.t.pr)}](${r.prUrl})` : '—'} | ${secs(r.t.healed)}${r.shopShowsName === undefined ? '' : r.shopShowsName ? ' (checkout shows the name)' : ' (checkout still broken)'} | ${secs(r.t.resolvedAfterUndo)} | **${r.oracle.verdict}**: ${r.oracle.detail} | ${r.falseAlarms.length ? r.falseAlarms.join('; ') : '0'} |`);
  }
  const flagged = run.results.filter((r) => r.event && r.event.detector === r.expected.detector).length;
  const passed = run.results.filter((r) => r.oracle.verdict === 'PASS').length, failed = run.results.filter((r) => r.oracle.verdict === 'FAIL').length;
  L.push('', `**${flagged} of ${run.results.length} changes flagged by the expected detector · fix checks: ${passed} PASS, ${failed} FAIL · false alarms: ${run.results.reduce((n, r) => n + r.falseAlarms.length, 0)}**`, '');
  L.push('## Every screen', '', '| Page | HTTP | Load | Text | Error overlay | Console errors |', '|---|---|---|---|---|---|');
  for (const p of run.screens) L.push(`| ${p.url} | ${p.status} | ${secs(p.ms)} | ${p.chars} chars | ${p.errorOverlay ? '**yes**' : 'no'} | ${p.consoleErrors.length ? p.consoleErrors.join(' / ') : '0'} |`);
  L.push('', 'Screenshots: `docs/verification/screens/`. Raw data: the `.json` next to this file.', '');
  return L.join('\n');
}

// ---------------------------------------------------------------------------------------------------------------

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const executablePath = browserPath();
  if (!executablePath) throw new Error('No Chrome/Brave/Edge found: set VERIFY_BROWSER to a Chromium browser executable');
  const browser = await chromium.launch({ headless: process.env.VERIFY_HEADLESS === '1', executablePath, args: ['--window-size=1500,950'] });
  const ctx = await browser.newContext({ viewport: { width: 1480, height: 900 } });
  await ctx.addCookies([await sessionCookie()]);
  const dash = await ctx.newPage();
  const shop = await ctx.newPage();
  await dash.goto(`${DASH}/app`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (dash.url().includes('/login')) throw new Error('dashboard sign-in failed (session cookie not accepted)');
  await shop.goto(SHOP, { waitUntil: 'domcontentloaded', timeout: 120_000 });

  const file = join(OUT, `pipeline-run-${DATE}.json`);
  // --only re-runs some scenarios and merges them into today's earlier run (same learning numbers, other rows kept)
  const prev = ONLY && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  const run = { date: new Date().toISOString(), browser: executablePath.split('/').pop(), learning: prev?.learning ?? {}, results: prev?.results ?? [], screens: [] };
  if (!SKIP_RESET) { log('reset (providers + Seismo data; the GitHub repo is untouched)'); await localReset(); }
  const learned = await learning();
  if (!SKIP_RESET || !prev) run.learning = learned;
  for (const s of SCENARIOS) {
    const r = await runScenario(s, dash, shop);
    r.rerun = !!prev;
    run.results = [...run.results.filter((x) => x.id !== s.id), r].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
    writeFileSync(join(OUT, `pipeline-run-${DATE}.json`), JSON.stringify(run, null, 2));
  }
  log('checking every screen');
  run.screens = await screens(ctx);
  writeFileSync(join(OUT, `pipeline-run-${DATE}.json`), JSON.stringify(run, null, 2));
  writeFileSync(join(OUT, `pipeline-run-${DATE}.md`), report(run));
  log(`report: docs/verification/pipeline-run-${DATE}.md`);
  await browser.close();
  const bad = run.results.filter((r) => !r.event || r.oracle.verdict === 'FAIL').length + run.screens.filter((p) => p.errorOverlay || p.status !== 200).length;
  process.exit(bad ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
