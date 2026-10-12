#!/usr/bin/env node
// `npm run github:webhook -- --to hosted|local|<url>`: where GitHub sends the Seismo App's events (PR merged, CI done).
// Only ONE engine may receive them: two engines would both react to the same merge and could open duplicate PRs.
//   hosted -> <engineUrl from .seismo-online.json>/api/github/webhooks   (npm run deploy:render wrote it)
//   local  -> WEBHOOK_PROXY_URL from .env (smee.io, relayed to npm run dev)
// Signs in as the App with APP_ID + PRIVATE_KEY (base64 PEM, as in .env). Prints the URL before and after.
import { createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const to = args.includes('--to') ? args[args.indexOf('--to') + 1] : undefined;
const die = (m) => { console.error(`✗ ${m}`); process.exit(1); };
if (!process.env.APP_ID || !process.env.PRIVATE_KEY) die('APP_ID and PRIVATE_KEY must be set in .env');

function appJwt() {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b({ alg: 'RS256', typ: 'JWT' }), body = b({ iat: now - 60, exp: now + 540, iss: process.env.APP_ID });
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(Buffer.from(process.env.PRIVATE_KEY, 'base64').toString('utf8'), 'base64url');
  return `${head}.${body}.${sig}`;
}
const gh = async (method, body) => {
  const r = await fetch('https://api.github.com/app/hook/config', { method, headers: { authorization: `Bearer ${appJwt()}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) die(`GitHub ${method} /app/hook/config -> ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
};

const current = await gh('GET');
console.log(`now:  ${current.url}`);
if (!to) process.exit(0);
const state = existsSync(join(ROOT, '.seismo-online.json')) ? JSON.parse(readFileSync(join(ROOT, '.seismo-online.json'), 'utf8')) : {};
const url = to === 'hosted' ? (state.engineUrl ? `${state.engineUrl}/api/github/webhooks` : die('no hosted engine yet: run npm run deploy:render'))
  : to === 'local' ? (process.env.WEBHOOK_PROXY_URL ?? die('WEBHOOK_PROXY_URL is not set in .env'))
  : /^https:\/\//.test(to) ? to : die('--to hosted | local | https://…');
if (url === current.url) { console.log('already set'); process.exit(0); }
const next = await gh('PATCH', { url, content_type: 'json' });
console.log(`set:  ${next.url}`);
