import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

/**
 * v2-P1.1: GitHub sign-in with the Seismo GitHub App's own OAuth credentials (same identity as installations).
 * The session only carries the GitHub login; the GitHub access token is never stored or sent to the browser.
 * Env (shared with the root .env): GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, AUTH_SECRET.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID ?? process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 3600 },
  callbacks: {
    jwt({ token, profile }) {
      if (profile && typeof profile.login === "string") token.login = profile.login;
      return token;
    },
    session({ session, token }) {
      if (typeof token.login === "string") session.user = { ...session.user, login: token.login };
      return session;
    },
    // Used by proxy.ts: signed-out users may only see public pages.
    authorized({ auth: session, request }) {
      const p = request.nextUrl.pathname;
      const isPrivate = p.startsWith("/app") || p.startsWith("/onboarding");
      return !isPrivate || !!session?.user;
    },
  },
});

declare module "next-auth" {
  interface User {
    login?: string;
  }
}
