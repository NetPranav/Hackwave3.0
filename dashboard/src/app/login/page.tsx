import type { Metadata } from "next";
import Logo from "@/components/layout/Logo";
import { signIn } from "@/auth";

export const metadata: Metadata = { title: "Sign in · Seismo" };

// v2-P1.2: sign in with GitHub (the Seismo GitHub App's OAuth). Visual design: Adarsh (v2-A0).
export default function LoginPage() {
  async function signInWithGitHub() {
    "use server";
    await signIn("github", { redirectTo: "/app" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-page-bg px-6">
      <div className="w-full max-w-sm rounded-xl border border-box-outline bg-section p-8">
        <Logo href="/" />
        <h1 className="mt-8 font-aeonik text-3xl leading-tight tracking-tight text-text-primary">Sign in</h1>
        <p className="mt-2 font-aeonik-light text-sm leading-relaxed text-text-primary/70">
          Seismo uses your GitHub account. We only read your login; your code is reached through the Seismo GitHub App you install.
        </p>
        <form action={signInWithGitHub} className="mt-8">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-btn-primary px-6 py-3 font-aeonik-mono text-sm uppercase tracking-wider text-white transition hover:scale-[1.02] hover:opacity-90"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
            </svg>
            Sign in with GitHub
          </button>
        </form>
      </div>
    </main>
  );
}
