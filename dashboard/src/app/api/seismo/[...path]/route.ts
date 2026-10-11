import { auth } from "@/auth";
import { backendToken as bearer, backendUrl as API } from "@/lib/server/backend";

/**
 * v2-P0.3 / P1.3: the only way the browser talks to the Seismo backend.
 *  - Reads the Auth.js session (server side) and signs a short HS256 JWT {sub: githubLogin} with AUTH_SECRET,
 *    which the backend's requireUser accepts. No token ever reaches the browser.
 *  - Streams responses through, so the SSE endpoint (/v1/events) works with a plain EventSource and no token in the URL.
 * Only /v1/* paths are forwarded; /internal and /admin stay unreachable from the browser.
 */
async function forward(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  const login = session?.user?.login;
  if (!login) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { path } = await ctx.params;
  if (path[0] !== "v1") return Response.json({ error: "not_found" }, { status: 404 });
  const isEvents = path.join("/") === "v1/events";
  const incoming = new URL(req.url);
  const target = new URL(`${API()}/${path.map(encodeURIComponent).join("/")}`);
  incoming.searchParams.forEach((v, k) => target.searchParams.set(k, v));

  const headers = new Headers({ accept: req.headers.get("accept") ?? "application/json" });
  const token = await bearer(login, isEvents ? "sse" : "api");
  if (isEvents) {
    if (token) target.searchParams.set("token", token);
  } else if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  if (hasBody) headers.set("content-type", req.headers.get("content-type") ?? "application/json");

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await req.text() : undefined,
      // actions (open a PR, setup PR: clone + codemod + stress test) can take up to a minute; reads should be quick
      signal: isEvents ? req.signal : AbortSignal.timeout(hasBody ? 90_000 : 20_000),
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: "backend_unreachable" }, { status: 503 });
  }
  const out = new Headers({ "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-store" });
  if (isEvents) out.set("x-accel-buffering", "no");
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export { forward as GET, forward as POST, forward as PUT, forward as DELETE };
