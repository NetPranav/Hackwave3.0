import { request } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * v3-P0.5 one public service: the backend forwards `/api/github/*` (GitHub webhooks) to the GitHub App and `/providers/*`
 * (the demo's fake third-party APIs) to the fake providers, both running beside it on loopback ports. The raw body is
 * streamed untouched so GitHub's webhook signature still verifies. Returns true when the request was taken.
 */
export interface ForwardRule { prefix: string; target: string | undefined; strip: boolean }

export function forwardRules(env: NodeJS.ProcessEnv = process.env): ForwardRule[] {
  return [
    { prefix: '/api/github/', target: env.GITHUB_APP_INTERNAL_URL, strip: false },
    { prefix: '/providers/', target: env.PROVIDERS_INTERNAL_URL, strip: true },
    // ...and the providers' own paths, unprefixed: the SDK records the URL path as the endpoint, so the hosted shop must
    // call https://<engine>/users/u_1 (not /providers/users/u_1) for its endpoints to match the code map. None of these
    // collide with the backend's routes (/health, /ready, /internal, /v1).
    ...['/users', '/payments', '/shipments', '/shipping/', '/orders', '/admin/'].map((prefix) => ({ prefix, target: env.PROVIDERS_INTERNAL_URL, strip: false })),
  ];
}

export function tryForward(req: IncomingMessage, res: ServerResponse, rules: ForwardRule[]): boolean {
  const url = req.url ?? '';
  const rule = rules.find((r) => r.target && url.startsWith(r.prefix));
  if (!rule) return false;
  const target = new URL(rule.target!);
  const path = rule.strip ? url.slice(rule.prefix.length - 1) : url;
  const headers = { ...req.headers, host: target.host };
  const up = request({ hostname: target.hostname, port: target.port, method: req.method, path, headers, timeout: 30_000 }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  up.on('timeout', () => up.destroy(new Error('timeout')));
  up.on('error', () => { if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' }); res.end('{"error":"upstream_unreachable"}'); });
  req.pipe(up);
  return true;
}
