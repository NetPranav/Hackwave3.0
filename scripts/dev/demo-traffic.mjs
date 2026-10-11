// P1.8: `npm run demo:traffic -- --rps 5 [--target http://localhost:4100]`
// Hits the fake services (or the shop via --target) at a steady rate so baselines fill without clicking.
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const rps = Number(arg('rps', '5'));
const target = arg('target', process.env.SERVICES_URL ?? 'http://localhost:4100');
const paths = ['/users/u_1', '/users/u_2', '/users', '/payments/pay_1', '/payments/pay_2', '/shipments/sh_1', '/shipments/sh_2', '/orders?limit=20', '/orders?limit=500'];
let n = 0, errors = 0;
setInterval(async () => {
  try { const r = await fetch(target + paths[n++ % paths.length]); await r.text(); if (!r.ok && r.status !== 404) errors++; } catch { errors++; }
}, 1000 / rps);
setInterval(() => console.log(`${n} requests, ${errors} errors`), 5000);
