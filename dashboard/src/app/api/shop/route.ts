import { auth } from "@/auth";
import { backendToken, backendUrl } from "@/lib/server/backend";

/**
 * "Open the demo shop": wherever it runs right now. The engine checks the hosted shop (registered by
 * `npm run demo:online`, the repo's homepage, the latest Production deployment) with a real request and falls back to
 * the local shop when none answers. ?refresh=1 re-checks now.
 */
export async function GET(req: Request) {
  const login = (await auth())?.user?.login;
  const local = process.env.SHOP_LOCAL_URL ?? "http://localhost:3100";
  if (!login) return Response.redirect(local, 307);
  const token = await backendToken(login);
  const refresh = new URL(req.url).searchParams.get("refresh") === "1" ? "?refresh=1" : "";
  try {
    const r = await fetch(`${backendUrl()}/v1/demo/shop${refresh}`, { headers: token ? { authorization: `Bearer ${token}` } : {}, cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const loc = r.ok ? ((await r.json()) as { url?: string }) : {};
    return Response.redirect(loc.url ?? local, 307);
  } catch {
    return Response.redirect(local, 307);
  }
}
