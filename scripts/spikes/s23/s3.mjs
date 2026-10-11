import { Probot, Server } from 'probot';
import { createHmac, generateKeyPairSync } from 'node:crypto';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'pkcs1', format: 'pem' } });
const secret = 'spike';
let got = null;
const server = new Server({ Probot: Probot.defaults({ appId: 1, privateKey, secret }), webhookPath: '/api/github/webhooks', port: 3999 });
await server.load((app) => { app.on('push', async (ctx) => { got = ctx.payload.ref; }); });
await server.start();
const body = JSON.stringify({ ref: 'refs/heads/main', repository: { name: 'x', owner: { login: 'o' } }, installation: { id: 1 } });
const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
const r = await fetch('http://localhost:3999/api/github/webhooks', { method: 'POST', headers: { 'content-type': 'application/json', 'x-github-event': 'push', 'x-github-delivery': 'd1', 'x-hub-signature-256': sig }, body });
await new Promise((r) => setTimeout(r, 300));
console.log('status', r.status, 'handler got ref:', got);
await server.stop?.(); process.exit(0);
