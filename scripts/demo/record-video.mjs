#!/usr/bin/env node
// `npm run demo:video`: records the PS-3 demo as one continuous screen video, end to end on the live setup:
//   problem -> live shop works -> silent provider change breaks it -> Seismo detects it -> fix PR (automatic for a rename,
//   "Open fix PR (stress-tested)" for a type change) -> GitHub PR -> merge -> Vercel rebuilds -> the live shop is fixed.
// Waiting periods (detection, rebuild) are sped up afterwards with ffmpeg. Output: docs/demo/seismo-demo.mp4.
//
//   npm run demo:video -- --login     once: sign in to GitHub in the recording browser (its own profile)
//   npm run demo:video                record (needs: hosted engine + live shop + traffic, see docs/DEMO.md)
// A person merges each PR (in this browser if signed in to GitHub, else in their own browser: it opens in Safari).
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const STATE = existsSync(join(ROOT, '.seismo-online.json')) ? JSON.parse(readFileSync(join(ROOT, '.seismo-online.json'), 'utf8')) : {};
const ENGINE = process.env.VIDEO_ENGINE ?? STATE.engineUrl ?? 'http://localhost:4000';
const SHOP = process.env.VIDEO_SHOP ?? 'https://seismo-demo-shop.vercel.app';
const DASH = process.env.VIDEO_DASHBOARD ?? 'http://localhost:3000';
const SHOP_DIR = join(ROOT, '..', 'seismo-demo-shop');
const PROFILE = join(ROOT, '.demo-browser');           // git-ignored: the recording browser's own profile (GitHub login)
const OUT = join(ROOT, 'docs', 'demo');
const RAW = join(OUT, 'raw');
const BROWSER = [process.env.VIDEO_BROWSER, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'].find((p) => p && existsSync(p));
const W = 1440, H = 900;
const RENAME_TO = process.env.VIDEO_RENAME_TO ?? 'fullName';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---- engine / provider helpers --------------------------------------------------------------------------------------
function bearer() {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000), login = (process.env.SEISMO_PROJECT_OWNERS ?? 'NetPranav').split(',')[0];
  const h = b({ alg: 'HS256', typ: 'JWT' }), p = b({ sub: login, iat: now, exp: now + 300 });
  return `${h}.${p}.${createHmac('sha256', process.env.AUTH_SECRET).update(`${h}.${p}`).digest('base64url')}`;
}
async function steady(url, init = {}) {
  for (let i = 0; ; i++) {
    const r = await fetch(url, init).catch(() => undefined);
    if (r && r.status < 502) return r;
    if (i > 6) throw new Error(`${url} -> ${r?.status ?? 'unreachable'}`);
    await sleep(3000);
  }
}
const api = async (path, init = {}) => (await steady(`${ENGINE}${path}`, { ...init, headers: { authorization: `Bearer ${bearer()}`, 'content-type': 'application/json', ...init.headers } })).json();
const admin = (path, init = {}) => steady(`${ENGINE}${path}`, { ...init, headers: { 'x-admin-token': process.env.DEMO_ADMIN_TOKEN, 'content-type': 'application/json', ...init.headers } });

// ---- recording: segments marked as "wait" are sped up afterwards ----------------------------------------------------
let t0 = 0;
const waits = [];
async function waiting(label, fn) {
  const start = Date.now() - t0;
  const r = await fn();
  waits.push({ label, start, end: Date.now() - t0 });
  return r;
}

/** A caption bar at the bottom of whatever page is showing (set through the DOM, so it works on GitHub too). */
async function caption(page, text, kind = 'info') {
  await page.evaluate(([t, k]) => {
    let el = document.getElementById('__seismo_caption');
    if (!el) { el = document.createElement('div'); el.id = '__seismo_caption'; document.documentElement.appendChild(el); }
    Object.assign(el.style, { position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)', zIndex: '2147483647', maxWidth: '1100px',
      padding: '14px 22px', borderRadius: '12px', font: '600 19px/1.4 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', color: '#fff',
      background: k === 'bad' ? 'rgba(190,40,30,0.94)' : k === 'good' ? 'rgba(20,120,60,0.94)' : 'rgba(17,17,17,0.92)', boxShadow: '0 8px 30px rgba(0,0,0,0.35)', textAlign: 'center' });
    el.textContent = t;
  }, [text, kind]).catch(() => undefined);
}

const CARD_CSS = `body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0d0d0d;color:#f2f2f2;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}
main{max-width:1040px;padding:48px}h1{font-size:54px;line-height:1.05;margin:0 0 24px;letter-spacing:-1px}h1 b{color:#ff6e3e}
p{font-size:23px;line-height:1.5;color:#cfcfcf;margin:14px 0}li{font-size:22px;line-height:1.5;color:#d8d8d8;margin:10px 0}
.k{font:600 14px ui-monospace,Menlo,monospace;letter-spacing:.2em;text-transform:uppercase;color:#ff6e3e;margin-bottom:18px}.src{font-size:15px;color:#8a8a8a;margin-top:26px}`;
async function card(page, html, ms) { await page.setContent(`<style>${CARD_CSS}</style><main>${html}</main>`); await sleep(ms); }

/** page.goto with a longer timeout and one retry (network blips happen during a 10-minute recording) */
async function go(page, url) {
  for (let i = 0; ; i++) {
    try { return await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 }); }
    catch (e) { if (i >= 1) throw e; await sleep(3000); }
  }
}

// ---- the demo ---------------------------------------------------------------------------------------------------------
async function openPanel(page) {
  if (!(await page.locator('select[aria-label="Provider"]').count())) await page.locator('.demo-fab').click();
  await page.locator('select[aria-label="Provider"]').waitFor({ timeout: 20_000 });
}
async function applyChange(page, c) {
  await openPanel(page);
  await page.selectOption('select[aria-label="Provider"]', c.service);
  await page.selectOption('select[aria-label="Kind of change"]', c.kind);
  await page.fill('input[aria-label="Field"]', c.field);
  if (c.kind === 'type') await page.selectOption('select[aria-label="New type"]', c.input);
  else await page.fill('input[aria-label="New name"]', c.input);
  await sleep(900);
  // the panel greys its buttons while it refreshes: wait until Apply is enabled, then make sure the provider really has
  // the change (found in a recording: a click on a greyed-out Apply did nothing and the shop never broke)
  const apply = page.getByRole('button', { name: 'Apply' });
  for (let attempt = 0; attempt < 4; attempt++) {
    await apply.waitFor({ state: 'visible' });
    for (let i = 0; i < 40 && !(await apply.isEnabled()); i++) await sleep(250);
    await apply.click();
    for (let i = 0; i < 20; i++) {
      const live = await (await admin('/admin/custom')).json();
      if (live.some((x) => x.service === c.service && x.field === c.field && x.kind === c.kind)) { await sleep(1000); return; }
      await sleep(500);
    }
  }
  throw new Error(`the panel did not apply ${c.service} ${c.kind} ${c.field}`);
}

async function waitForEvent(match, until, page, label) {
  return waiting(label, async () => {
    const deadline = Date.now() + 6 * 60_000;
    let lastReload = 0;
    while (Date.now() < deadline) {
      const ev = (await api('/v1/drift-events')).find(match);
      if (ev && until(ev)) return ev;
      if (Date.now() - lastReload > 12_000) { await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined); await caption(page, label); lastReload = Date.now(); }
      await sleep(2500);
    }
    throw new Error(`timed out: ${label}`);
  });
}

async function mergeOnGitHub(page, prUrl, what) {
  await go(page, `${prUrl}/files`);
  await caption(page, `${what}: the whole fix is one data rule in seismo/aliases.json. No code is generated.`);
  await sleep(6500);
  await go(page, prUrl);
  await caption(page, 'Seismo already ran the safety checks (C1–C9 incl. a 2000-response stress test). A human merges.');
  await sleep(4500);
  // A person merges. Signed in here: this browser's Merge button. Otherwise in your own signed-in browser (e.g. Safari):
  // the recording waits on this PR page, checks GitHub read-only, and shows the PR turning "Merged".
  const [, repo, num] = /github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/.exec(prUrl);
  const merged = () => { try { return JSON.parse(execFileSync('gh', ['pr', 'view', num, '-R', repo, '--json', 'state'], { encoding: 'utf8' })).state === 'MERGED'; } catch { return false; } };
  await caption(page, 'Merge.');
  console.log(`\n  >>> MERGE NOW in your browser: ${prUrl}  (the recording waits until it is merged)\n`);
  writeFileSync(join(OUT, 'MERGE-NOW.txt'), `${prUrl}\n`);
  try { execFileSync('open', ['-a', 'Safari', prUrl]); } catch { /* the URL is printed above */ }
  await waiting('waiting for the merge', async () => {
    for (let i = 0; !merged(); i++) { if (i > 360) throw new Error(`not merged after 30 minutes: ${prUrl}`); await sleep(5000); }
  });
  rmSync(join(OUT, 'MERGE-NOW.txt'), { force: true });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText(/merged commit|\bMerged\b/).first().waitFor({ timeout: 60_000 }).catch(() => undefined);
  await caption(page, 'Merged. Vercel now rebuilds the shop from main: no manual pull, no deploy step.', 'good');
  await sleep(4000);
}

async function waitForShopFixed(page, path, isFixed, label) {
  const mergedAt = Date.now();
  await waiting(label, async () => {
    const deadline = Date.now() + 6 * 60_000;
    while (Date.now() < deadline) {
      await go(page, `${SHOP}${path}`).catch(() => undefined);
      await caption(page, label);
      if (Date.now() - mergedAt > 30_000 && (await isFixed(page))) return;
      await sleep(8000);
    }
    throw new Error(`the shop was not fixed in 6 minutes (${path})`);
  });
}

async function record(ctx) {
  // the profile may restore tabs from an earlier run: record in one fresh tab only
  const page = await ctx.newPage();
  for (const p of ctx.pages()) if (p !== page) await p.close().catch(() => undefined);
  t0 = Date.now();
  log('recording');

  // 1. the problem (docs/PS/problem.md, evidence.md; numbers carry their label)
  await card(page, `<div class="k">HackWave 3.0 · PS 3 · The Internet After the API</div>
    <h1>APIs change <b>silently</b>.</h1>
    <p>Apps are built from APIs they don't control: payments, users, shipping. A provider renames a field or changes a type and the API still answers <b>200 OK</b> with valid JSON.</p>
    <p>Nothing crashes. Dashboards stay green. The app shows wrong names and wrong totals, and the team finds out from a customer.</p>
    <p class="src">1,970 of 3,075 web APIs did not always flag breaking changes in minor/patch releases (Confirmed, ICWE 2024).</p>`, 11_000);
  await card(page, `<div class="k">Seismo · Dependabot for the APIs you depend on</div>
    <h1>Detect the change. <b>Fix it with a pull request.</b></h1>
    <ul><li>Watches <b>real traffic</b> from inside the app: shapes and statistics only, never a record's values</li>
    <li>Deterministic detectors: rename, type change, unit change, new values, silent truncation…</li>
    <li>Knows which line of <b>your code</b> reads the field, so it knows what breaks</li>
    <li>Opens a <b>safe fix PR</b>: one data rule, stress-tested. The AI explains; it never writes code. A human merges.</li></ul>`, 13_000);

  // 2. rename: the shop works
  await go(page, SHOP);
  await caption(page, 'A live demo shop (Vercel) that calls four third-party APIs: users, payments, shipping, orders.');
  await sleep(5000);
  await page.getByRole('button', { name: /Buy now/ }).first().click().catch(() => undefined);
  await page.waitForURL(/checkout/, { timeout: 15_000 }).catch(() => page.goto(`${SHOP}/checkout`, { waitUntil: 'domcontentloaded' }));
  await caption(page, 'Checkout reads the customer name from the users API. All good.', 'good');
  await sleep(5000);

  // 3. the silent change
  await applyChange(page, { service: 'users', kind: 'rename', field: 'name', input: RENAME_TO });
  await caption(page, `The users provider silently renames "name" → "${RENAME_TO}". Still 200 OK. No changelog, no error.`, 'bad');
  await sleep(4500);
  for (let i = 0; i < 6; i++) {
    await go(page, `${SHOP}/checkout`);
    if (await page.getByText('name missing').count()) break;
    await sleep(2000);
  }
  await caption(page, 'The shop breaks quietly: "name missing". No crash, no alert, nothing in the logs.', 'bad');
  await sleep(6000);

  // 4. Seismo detects it and opens the fix PR by itself
  await go(page, `${DASH}/app/timeline`);
  await caption(page, 'Seismo compares live traffic with what it learned. Detecting (about a minute)…');
  const rename = await waitForEvent((e) => e.detector === 'D3' && e.title.includes(RENAME_TO), (e) => !!e.fix?.validation?.prUrl, page, 'Seismo compares live traffic with what it learned. Detecting (about a minute)…');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await caption(page, `Found: "${rename.title}", breaking, because the checkout reads "name". Fix PR opened automatically.`, 'good');
  await sleep(6000);
  await go(page, `${DASH}/app/drift/${rename.id}`);
  await caption(page, 'The evidence, the exact code line that reads the field, and an AI explanation (Nemotron). Detection itself is deterministic.');
  await sleep(8000);

  // 5. GitHub: review + merge
  await mergeOnGitHub(page, rename.fix.validation.prUrl, 'Rename');

  // 6. fixed
  await waitForShopFixed(page, '/checkout', async (p) => !(await p.getByText('name missing').count()), 'Vercel is rebuilding the shop from main…');
  await caption(page, `Fixed. The provider still sends "${RENAME_TO}"; the merged rule puts "name" back for the code. Nobody touched the app's code.`, 'good');
  await sleep(7000);

  // 7. type change: money/logic field, goes to review, a person opens the stress-tested PR
  await go(page, `${SHOP}/orders`);
  await caption(page, 'Second change: the orders API starts sending total_rupees as text instead of a number.');
  await sleep(4000);
  await applyChange(page, { service: 'orders', kind: 'type', field: 'total_rupees', input: 'string' });
  await go(page, `${SHOP}/orders`);
  await caption(page, 'The order total is now nonsense: the numbers are glued together as text. Still 200 OK.', 'bad');
  await sleep(6000);
  await go(page, `${DASH}/app/review`);
  const type = await waitForEvent((e) => e.detector === 'D4' && e.title.includes('total_rupees'), (e) => ['breaking', 'suspected'].includes(e.state), page, 'Type changes touch money and logic: Seismo sends them to Review, never fixes them alone. Detecting…');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await caption(page, `Found: "${type.title}". Proposed fix: convert it back to a number (a fixed template, not AI code).`);
  await sleep(3500);
  await page.getByText(type.title).first().click().catch(() => undefined);
  await sleep(2000);
  const open = page.getByRole('button', { name: /Open fix PR \(stress-tested\)/ }).first();
  await open.scrollIntoViewIfNeeded().catch(() => undefined);
  await caption(page, 'A person decides: "Open fix PR". Seismo stress-tests the rule on 2000 generated responses first.');
  await sleep(3500);
  await open.click();
  const prLink = page.getByRole('link', { name: /PR #\d+ · needs review/ }).first();
  await waiting('opening the PR', () => prLink.waitFor({ timeout: 180_000 }));
  await sleep(2500);
  const typePr = await prLink.getAttribute('href');
  await mergeOnGitHub(page, typePr, 'Type change');
  await waitForShopFixed(page, '/orders', async (p) => /total ₹[\d,]+ \(/.test(await p.locator('body').innerText().catch(() => '')) && !/total ₹0\d/.test(await p.locator('body').innerText().catch(() => '')), 'Vercel is rebuilding the shop from main…');
  await caption(page, 'Fixed: the total is a real number again. The provider still sends text.', 'good');
  await sleep(7000);

  // 8. close
  await card(page, `<div class="k">What you just saw</div>
    <h1>Silent API change → <b>merged fix</b>, in minutes.</h1>
    <ul><li>Caught from real traffic, about a minute after the change: no polling, no spec needed</li>
    <li>Mapped to the code that breaks, so it knows how serious it is</li>
    <li>Fixed as data, not code: one rule, additive, proven safe and stress-tested before the PR opens</li>
    <li>Renames get a PR by themselves; money and logic changes wait for a person</li></ul>
    <p class="src">Seismo · github.com/NetPranav/Hackwave3.0</p>`, 12_000);
}

async function main() {
  if (!BROWSER) throw new Error('No Chrome/Brave found: set VIDEO_BROWSER');
  if (args.includes('--login')) {
    const ctx = await chromium.launchPersistentContext(PROFILE, { executablePath: BROWSER, headless: false, viewport: { width: W, height: H } });
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto('https://github.com/login');
    await page.bringToFront();
    log('sign in to GitHub in the window that opened (waiting up to 20 minutes)…');
    for (let i = 0; i < 400; i++) {
      // GitHub sets <meta name="user-login"> on every page once signed in; look on github.com itself now and then
      if (i % 10 === 9 && !/\/(login|session|sessions)/.test(page.url())) await page.goto('https://github.com/').catch(() => undefined);
      const who = await page.locator('meta[name="user-login"]').getAttribute('content').catch(() => '');
      if (who) { log(`signed in as ${who}`); await ctx.close(); return; }
      await sleep(3000);
    }
    throw new Error('not signed in after 20 minutes');
  }

  // preconditions: nobody else's change on, the engine learned the traffic, self-heal off (the break must be visible)
  if ((await (await admin('/admin/custom')).json()).length) throw new Error('a panel change is still on: turn it off first (shop panel -> undo)');
  const ready = await api('/v1/readiness');
  if (ready.length < 4 || ready.some((r) => !r.ready)) throw new Error(`Seismo is still learning: ${JSON.stringify(ready)}`);
  if ((await api('/v1/settings/notifications')).autoHeal) throw new Error('turn off Settings -> Self-heal renames for the video (the break must stay visible until the merge)');
  // a rule already targeting "name" makes the planner (check C5) refuse a second one: the rename would go to review
  const rules = JSON.parse(execFileSync('gh', ['api', 'repos/NetPranav/seismo-demo-shop/contents/seismo/aliases.json', '-H', 'Accept: application/vnd.github.raw'], { encoding: 'utf8' })).rules;
  if (rules.some((r) => (!r.kind || r.kind === 'alias') && r.target === 'name')) throw new Error('the shop already has an alias rule for "name" (seismo/aliases.json): remove it first, or the rename gets no automatic PR');

  rmSync(RAW, { recursive: true, force: true }); mkdirSync(RAW, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, { executablePath: BROWSER, headless: false, viewport: { width: W, height: H }, recordVideo: { dir: RAW, size: { width: W, height: H } }, args: [`--window-size=${W},${H + 90}`] });
  const { encode } = await import(join(ROOT, 'dashboard', 'node_modules', '@auth', 'core', 'jwt.js'));
  const login = (process.env.SEISMO_PROJECT_OWNERS ?? 'NetPranav').split(',')[0];
  await ctx.addCookies([{ name: 'authjs.session-token', value: await encode({ token: { name: login, login, sub: login }, secret: process.env.AUTH_SECRET, salt: 'authjs.session-token', maxAge: 8 * 3600 }), domain: 'localhost', path: '/' }]);
  try { await record(ctx); }
  finally {
    await ctx.close();
    // put the providers back (the merged rules keep the shop working either way); never hide the real error
    try { for (const c of await (await admin('/admin/custom')).json()) await admin(`/admin/custom/${c.id}`, { method: 'DELETE' }); }
    catch (e) { console.error(`cleanup: could not turn the demo changes off (${e.message}); use the shop panel`); }
  }
  const raw = readdirSync(RAW).filter((f) => f.endsWith('.webm')).map((f) => join(RAW, f)).sort((a, b) => statSync(b).size - statSync(a).size)[0];
  writeFileSync(join(OUT, 'segments.json'), JSON.stringify({ waits }, null, 2));
  edit(raw, join(OUT, 'seismo-demo.mp4'));
}

/** Speed up the waiting periods (8x), keep everything else real-time, encode H.264 MP4. */
function edit(input, output) {
  const parts = [];
  let at = 0;
  for (const w of waits.sort((a, b) => a.start - b.start)) {
    if (w.end - w.start < 4000) continue;
    if (w.start > at) parts.push({ from: at, to: w.start, speed: 1 });
    parts.push({ from: w.start, to: w.end, speed: 8 });
    at = w.end;
  }
  parts.push({ from: at, to: null, speed: 1 });
  const s = (ms) => (ms / 1000).toFixed(2);
  const chains = parts.map((p, i) => `[0:v]trim=start=${s(p.from)}${p.to ? `:end=${s(p.to)}` : ''},setpts=(PTS-STARTPTS)/${p.speed}[v${i}]`);
  const filter = `${chains.join(';')};${parts.map((_, i) => `[v${i}]`).join('')}concat=n=${parts.length}:v=1:a=0[out]`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', input, '-filter_complex', filter, '-map', '[out]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-preset', 'medium', '-movflags', '+faststart', output]);
  log(`video: ${output}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
