import { auth } from "@/auth";

/**
 * v2-P4.2: Demo Control's server side. Flips the fake providers with DEMO_ADMIN_TOKEN, which never reaches the browser.
 * Only with DEMO_MODE=true and a signed-in user. Reset also clears Seismo's data (backend /internal/demo/reset).
 *   GET  /api/demo/scenarios          POST /api/demo/scenarios/{id} {enabled}
 *   POST /api/demo/rollout/{id} {percent}   POST /api/demo/reset
 */
const SERVICES = () => process.env.SERVICES_URL ?? "http://localhost:4100";
const BACKEND = () => process.env.SEISMO_API_URL ?? "http://localhost:4000";

async function handle(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (process.env.DEMO_MODE !== "true") return Response.json({ error: "demo_mode_off" }, { status: 404 });
  const session = await auth();
  if (!session?.user?.login) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { path } = await ctx.params;
  const admin = { "x-admin-token": process.env.DEMO_ADMIN_TOKEN ?? "", "content-type": "application/json" };
  const call = async (url: string, init: RequestInit) => {
    try {
      const r = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(15_000) });
      return new Response(r.body, { status: r.status, headers: { "content-type": r.headers.get("content-type") ?? "application/json" } });
    } catch {
      return Response.json({ error: "unreachable", url }, { status: 503 });
    }
  };
  const [head, id] = path;
  if (req.method === "GET" && head === "scenarios" && !id) return call(`${SERVICES()}/admin/scenarios`, { headers: admin });
  if (req.method === "POST" && (head === "scenarios" || head === "rollout") && id)
    return call(`${SERVICES()}/admin/${head}/${encodeURIComponent(id)}`, { method: "POST", headers: admin, body: await req.text() });
  if (req.method === "POST" && head === "reset") {
    const services = await call(`${SERVICES()}/admin/reset`, { method: "POST", headers: admin, body: "{}" });
    const seismo = await call(`${BACKEND()}/internal/demo/reset`, {
      method: "POST",
      headers: { "x-internal-token": process.env.INTERNAL_TOKEN ?? "dev-internal", "content-type": "application/json" },
      body: "{}",
    });
    return Response.json({ services: services.status, seismo: seismo.status }, { status: services.ok && seismo.ok ? 200 : 502 });
  }
  return Response.json({ error: "not_found" }, { status: 404 });
}

export { handle as GET, handle as POST };
