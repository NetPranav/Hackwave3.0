import { jwtVerify, SignJWT } from 'jose';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * P0.11: the dashboard (Auth.js) mints a short HS256 JWT {sub: githubLogin} signed with AUTH_SECRET and
 * sends it as `Authorization: Bearer`. EventSource cannot send headers, so SSE uses a 60 s token in `?token=`.
 * With AUTH_SECRET unset (local dev) every request is the demo user.
 */
const secret = () => (process.env.AUTH_SECRET ? new TextEncoder().encode(process.env.AUTH_SECRET) : null);

export async function signUserToken(login: string, ttl = '1h', scope: 'api' | 'sse' = 'api') {
  const s = secret();
  if (!s) throw new Error('AUTH_SECRET is not set');
  return new SignJWT({ scope }).setProtectedHeader({ alg: 'HS256' }).setSubject(login).setExpirationTime(ttl).sign(s);
}

export async function userFrom(req: FastifyRequest, scope: 'api' | 'sse' = 'api'): Promise<string | null> {
  const s = secret();
  if (!s) return 'demo-user';
  const header = req.headers.authorization?.replace(/^Bearer /, '');
  const token = scope === 'sse' ? (req.query as { token?: string }).token : header;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, s);
    if (scope === 'sse' && payload.scope !== 'sse') return null;
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

declare module 'fastify' {
  interface FastifyRequest { user?: string }
}

export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  const user = await userFrom(req);
  if (!user) return reply.code(401).send({ error: 'unauthorized' });
  req.user = user;
}
