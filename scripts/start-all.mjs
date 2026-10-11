// v3-P0.5: the whole engine as ONE service (for free hosts that keep one process awake): fake providers and the GitHub
// App on loopback ports, the backend on $PORT forwarding /providers/* and /api/github/* to them. A crashed child is
// restarted; the backend exiting ends the container (the host restarts it).
import { spawn } from 'node:child_process';

const PORT = process.env.PORT ?? '4000';
const PROVIDERS_PORT = process.env.PROVIDERS_PORT ?? '4100';
const APP_PORT = process.env.GITHUB_APP_INTERNAL_PORT ?? '3060';
const env = {
  ...process.env,
  PROVIDERS_INTERNAL_URL: `http://127.0.0.1:${PROVIDERS_PORT}`,
  GITHUB_APP_INTERNAL_URL: `http://127.0.0.1:${APP_PORT}`,
  GITHUB_APP_URL: process.env.GITHUB_APP_URL ?? `http://127.0.0.1:${APP_PORT}`,
  BACKEND_URL: process.env.BACKEND_URL ?? `http://127.0.0.1:${PORT}`,
};
const procs = {
  providers: { cmd: ['services/dist/server.js'], env: { ...env, PORT: PROVIDERS_PORT } },
  'github-app': { cmd: ['github-app/dist/server.js'], env: { ...env, GITHUB_APP_PORT: APP_PORT, GITHUB_APP_HOST: '127.0.0.1' } },
  backend: { cmd: ['backend/dist/server.js'], env: { ...env, PORT }, essential: true },
};
const children = new Set();
let stopping = false;
const start = (name) => {
  const p = procs[name];
  if (name === 'github-app' && !process.env.APP_ID) return console.log('[start-all] github-app skipped (APP_ID not set)');
  const child = spawn(process.execPath, p.cmd, { env: p.env, stdio: 'inherit' });
  children.add(child);
  child.on('exit', (code) => {
    children.delete(child);
    if (stopping) return;
    if (p.essential) { console.error(`[start-all] ${name} exited (${code}); stopping`); stop(code ?? 1); return; }
    console.error(`[start-all] ${name} exited (${code}); restarting in 3 s`);
    setTimeout(() => start(name), 3000);
  });
};
for (const name of Object.keys(procs)) start(name);
// stop the children with us (otherwise they keep their ports after the container or terminal stops)
const stop = (code) => { stopping = true; for (const c of children) c.kill('SIGTERM'); setTimeout(() => process.exit(code), 500); };
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => stop(0));
