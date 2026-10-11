import { SignJWT } from "jose";

/** Server-side helpers for talking to the Seismo backend as the signed-in user (v2-P1.3). Never imported by client code. */

// Not PORT: inside `next dev` that is the dashboard's own port.
export const backendUrl = () => process.env.SEISMO_API_URL ?? "http://localhost:4000";

/** Short HS256 JWT {sub: login} that the backend's requireUser accepts; undefined when AUTH_SECRET is unset (no-auth dev). */
export async function backendToken(login: string, scope: "api" | "sse" = "api") {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return undefined;
  return new SignJWT({ scope })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(login)
    .setExpirationTime(scope === "sse" ? "60s" : "5m")
    .sign(new TextEncoder().encode(secret));
}

/** True when the backend says this user owns the deployment's project. */
export async function ownsProject(login: string): Promise<boolean> {
  const token = await backendToken(login);
  try {
    const r = await fetch(`${backendUrl()}/v1/projects`, { headers: token ? { authorization: `Bearer ${token}` } : {}, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    return r.ok && ((await r.json()) as unknown[]).length > 0;
  } catch {
    return false;
  }
}
