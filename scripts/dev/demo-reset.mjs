// `npm run demo:reset`: services back to v1 (repo/DB reset steps are added in P8.5).
const base = process.env.SERVICES_URL ?? 'http://localhost:4100';
const r = await fetch(`${base}/admin/reset`, { method: 'POST', headers: { 'x-admin-token': process.env.DEMO_ADMIN_TOKEN ?? 'dev-admin' } });
console.log('services reset:', r.status);
