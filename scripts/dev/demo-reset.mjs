// `npm run demo:reset` (P8.5): everything back to the start of the demo in < 30 s.
//   1. fake providers -> v1         2. Seismo data (events, fingerprints, alerts, radar) cleared
//   3. demo repo: Seismo PRs closed, seismo/* branches deleted, aliases.json emptied (DEMO_REPO only)
//   4. AI cache warmed for the demo scenarios (optional, needs NIM_API_KEY)
const t0 = Date.now();
const SERVICES = process.env.SERVICES_URL ?? 'http://localhost:4100';
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:4000';
const APP = process.env.GITHUB_APP_URL;
const internal = { 'content-type': 'application/json', 'x-internal-token': process.env.INTERNAL_TOKEN ?? 'dev-internal' };
const step = async (name, fn) => { try { const r = await fn(); console.log(`✓ ${name}${r ? `: ${r}` : ''}`); } catch (e) { console.log(`✗ ${name}: ${e.message}`); process.exitCode = 1; } };
const ok = async (r) => { if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`); return r.json().catch(() => ({})); };

await step('fake providers back to v1', async () => { await ok(await fetch(`${SERVICES}/admin/reset`, { method: 'POST', headers: { 'x-admin-token': process.env.DEMO_ADMIN_TOKEN ?? 'dev-admin' } })); });
await step('Seismo data cleared', async () => { await ok(await fetch(`${BACKEND}/internal/demo/reset`, { method: 'POST', headers: internal, body: '{}' })); });
if (APP && process.env.DEMO_REPO) await step(`demo repo ${process.env.DEMO_REPO} reset`, async () => JSON.stringify(await ok(await fetch(`${APP}/internal/demo-reset`, { method: 'POST', headers: internal, body: JSON.stringify({ repo: process.env.DEMO_REPO }) }))));
else console.log('- demo repo reset skipped (set GITHUB_APP_URL and DEMO_REPO)');
if (process.argv.includes('--warm')) await step('AI cache warmed', async () => JSON.stringify((await ok(await fetch(`${BACKEND}/internal/ai/warm`, { method: 'POST', headers: internal, body: '{}' }))).warmed?.length ?? 0));
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
