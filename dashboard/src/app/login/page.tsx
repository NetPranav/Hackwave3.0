import type { Metadata } from "next";
import AuthPage from "@/components/auth/AuthPage";
import GithubMark from "@/components/auth/GithubMark";
import { signIn } from "@/auth";

export const metadata: Metadata = { title: "Sign in · Seismo" };

// v2-P1: real GitHub sign-in (Auth.js, the Seismo GitHub App's OAuth). New users continue to onboarding.
async function signInWithGitHub() {
  "use server";
  await signIn("github", { redirectTo: "/onboarding" });
}

const NEXT_STEPS = [
  { title: "Sign in with GitHub", text: "One click. No new password." },
  { title: "Install the Seismo app", text: "You choose which repos it can read." },
  { title: "See your map", text: "Every API you call, and the code that depends on it." },
];

const PROMISES = ["Read-only. We never change your code on our own.", "We see the shape of API data, never the values.", "Every fix is a pull request you merge."];

export default function LoginPage() {
  return (
    <AuthPage logo={false}>
      <main className="grid flex-1 items-center gap-10 py-6 lg:min-h-0 lg:grid-cols-2 lg:gap-16">
        <section>
          <h1 className="font-aeonik text-5xl leading-[0.95] tracking-tight md:text-7xl">Sign in to Seismo</h1>
          <p className="mt-5 max-w-lg font-aeonik-light text-base leading-relaxed text-text-primary/70">
            Know when an API you depend on changes, before your users do.
          </p>

          <form action={signInWithGitHub}>
          <button
            type="submit"
            className="mt-8 inline-flex w-full max-w-md items-center justify-center gap-3 rounded-md bg-btn-primary px-6 py-3.5 font-aeonik-mono text-sm uppercase tracking-wider text-white transition-transform hover:scale-[1.02]"
          >
            <GithubMark />
            Continue with GitHub
          </button>
          </form>

          <ul className="mt-8 max-w-md space-y-2.5">
            {PROMISES.map((p) => (
              <li key={p} className="flex gap-2.5 font-aeonik-light text-sm text-text-primary/70">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        <aside className="rounded-xl border border-box-outline bg-section p-6 md:p-10">
          <p className="font-aeonik-mono text-xs uppercase tracking-[0.2em] text-text-primary/50">What happens next</p>
          <ol className="mt-6 space-y-4">
            {NEXT_STEPS.map((s, i) => (
              <li
                key={s.title}
                className="group relative flex cursor-default items-center gap-4 overflow-hidden rounded-md border border-box-outline bg-section p-4"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 origin-left scale-x-0 bg-btn-primary transition-transform duration-300 ease-out group-hover:scale-x-100"
                />
                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded border border-accent font-aeonik-mono text-sm text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-white">
                  {i + 1}
                </span>
                <div className="relative flex-1">
                  <p className="font-aeonik text-base transition-colors duration-300 group-hover:text-white">{s.title}</p>
                  <p className="mt-0.5 font-aeonik-light text-sm text-text-primary/60 transition-colors duration-300 group-hover:text-white/70">{s.text}</p>
                </div>
                <span
                  aria-hidden
                  className="relative -translate-x-3 font-aeonik-mono text-lg text-accent opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                >
                  →
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </main>
    </AuthPage>
  );
}
