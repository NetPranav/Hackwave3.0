/**
 * `import '@seismo/sdk/auto'` (v3-P1.1): starts the SDK from the environment and seismo.config.json, so the setup PR can
 * install Seismo with one import line. Without SEISMO_KEY it does nothing. Never throws (fail-open, like the SDK).
 *
 *   SEISMO_KEY          the project key (required)
 *   SEISMO_ENDPOINT     Seismo backend URL (default http://localhost:4000)
 *   SEISMO_SAMPLE_RATE  share of calls profiled (default 0.1)
 *   seismo.config.json  { "services": { "STRIPE_API_URL": "stripe", "SHOP_API_URL/orders": "orders" }, "enumAllowList": [...] }
 *                       keys are env var names (optionally + "/path"); the env var's value is the provider's base URL
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seismo, type InitOptions } from './client.js';

interface Config { services?: Record<string, string>; enumAllowList?: string[]; ignore?: string[] }

export function autoOptions(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): InitOptions | undefined {
  const key = env.SEISMO_KEY;
  if (!key) return undefined;
  let config: Config = {};
  try {
    const file = env.SEISMO_CONFIG ?? join(cwd, 'seismo.config.json');
    if (existsSync(file)) config = JSON.parse(readFileSync(file, 'utf8')) as Config;
  } catch { /* a broken config must not stop the app; run with defaults */ }
  const services: Record<string, string> = {};
  const hosts = new Set<string>();
  for (const [k, name] of Object.entries(config.services ?? {})) {
    const [envName, ...rest] = k.split('/');
    const base = env[envName!];
    if (!base) continue;
    try {
      const u = new URL(base);
      hosts.add(u.host);
      services[base.replace(/\/$/, '') + (rest.length ? '/' + rest.join('/') : '')] = name;
    } catch { /* not a URL: skip */ }
  }
  const rate = Number(env.SEISMO_SAMPLE_RATE);
  return {
    key,
    ...(env.SEISMO_ENDPOINT ? { endpoint: env.SEISMO_ENDPOINT } : {}),
    ...(Number.isFinite(rate) && rate > 0 && rate <= 1 ? { sampleRate: rate } : {}),
    ...(Object.keys(services).length ? { services, allowHosts: [...hosts] } : {}),
    ...(config.enumAllowList ? { enumAllowList: config.enumAllowList } : {}),
    ...(config.ignore ? { ignore: config.ignore.map((k) => { const [e, ...p] = k.split('/'); return (env[e!] ?? e) + (p.length ? '/' + p.join('/') : ''); }) } : {}),
  };
}

try {
  const opts = autoOptions();
  if (opts) seismo.init(opts);
} catch { /* fail-open */ }
