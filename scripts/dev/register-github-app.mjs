// P0.5: `npm run gh:register`. Creates your personal dev GitHub App with the manifest flow.
// Opens a local page that POSTs the manifest to GitHub; GitHub redirects back with a code; we exchange it
// for the app credentials and append them to .env (git-ignored). Needs WEBHOOK_PROXY_URL (a smee.io channel).
import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';
import { exec } from 'node:child_process';

const proxy = process.env.WEBHOOK_PROXY_URL;
if (!proxy) { console.error('Set WEBHOOK_PROXY_URL in .env first (create a channel at https://smee.io/new).'); process.exit(1); }
const port = 3456;
const manifest = {
  name: `Seismo dev ${process.env.USER ?? 'local'}`.slice(0, 34),
  url: 'http://localhost:3000',
  hook_attributes: { url: proxy, active: true },
  redirect_url: `http://localhost:${port}/callback`,
  callback_urls: ['http://localhost:3000/api/auth/callback/github'],
  setup_url: 'http://localhost:3000/onboarding',
  public: false,
  default_permissions: { contents: 'write', pull_requests: 'write', issues: 'write', checks: 'write', metadata: 'read', workflows: 'read' },
  default_events: ['push', 'pull_request', 'installation', 'installation_repositories'],
};
const page = `<form id=f method=post action="https://github.com/settings/apps/new"><input type=hidden name=manifest value='${JSON.stringify(manifest).replace(/'/g, '&#39;')}'></form><script>f.submit()</script>`;

const server = createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${port}`);
  if (u.pathname === '/') { res.setHeader('content-type', 'text/html'); return res.end(page); }
  if (u.pathname === '/callback') {
    const r = await fetch(`https://api.github.com/app-manifests/${u.searchParams.get('code')}/conversions`, { method: 'POST', headers: { accept: 'application/vnd.github+json' } });
    const a = await r.json();
    if (!a.id) { res.end('Failed: ' + JSON.stringify(a)); return; }
    appendFileSync('.env', `\nAPP_ID=${a.id}\nPRIVATE_KEY=${Buffer.from(a.pem).toString('base64')}\nWEBHOOK_SECRET=${a.webhook_secret}\nGITHUB_CLIENT_ID=${a.client_id}\nGITHUB_CLIENT_SECRET=${a.client_secret}\n`);
    res.end(`App "${a.name}" created. Credentials were appended to .env. Install it on a repo: ${a.html_url}/installations/new. You can close this tab.`);
    console.log('Done. Credentials written to .env (APP_ID, PRIVATE_KEY base64, WEBHOOK_SECRET, client id/secret).');
    server.close();
  }
});
server.listen(port, () => { console.log(`Open http://localhost:${port}`); exec(`open http://localhost:${port}`); });
