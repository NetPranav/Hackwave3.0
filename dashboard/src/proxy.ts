// v2-P1.2: optimistic route protection. Signed-out visits to /app/* or /onboarding go to /login
// (the `authorized` callback in auth.ts decides). The real check is in the /api/seismo route and the backend.
export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/app/:path*", "/onboarding/:path*"],
};
