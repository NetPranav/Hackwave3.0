"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/dashboard/Card";
import Logo from "@/components/layout/Logo";
import { api, useLive } from "@/lib/api/live";
import type { Installation, Me } from "@/lib/api/types";

type RepoAction = { busy?: "scan" | "setup"; message?: string; prUrl?: string };

const BUTTON =
  "inline-flex items-center gap-1.5 rounded border border-box-outline px-3 py-1.5 font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/80 transition-colors hover:border-text-primary hover:text-text-primary disabled:opacity-40 dark:border-dark-border dark:text-white/80 dark:hover:text-white";
const PRIMARY =
  "inline-flex items-center gap-2 rounded-md bg-btn-primary px-5 py-2.5 font-aeonik-mono text-xs uppercase tracking-wider text-white transition hover:opacity-90 dark:bg-dark-btn-primary";

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-baseline gap-3">
        <span className={"font-aeonik-mono text-xs " + (done ? "text-ok dark:text-ok-bright" : "text-accent")}>{done ? "✓" : String(n).padStart(2, "0")}</span>
        <h2 className="font-aeonik text-lg text-text-primary dark:text-white">{title}</h2>
      </div>
      <div className="mt-3 pl-7">{children}</div>
    </Card>
  );
}

/** v2-P2: sign in → install the app → repos scanned → optional setup PR → SDK key. Every step is real. */
export default function OnboardingView() {
  const me = useLive<Me>("/v1/me");
  const inst = useLive<Installation[]>("/v1/installations", ["drift.created"], undefined, { pollMs: 4000 });
  const [actions, setActions] = useState<Record<string, RepoAction>>({});
  const installs = inst.data ?? [];
  const installed = (me.data?.installations.length ?? 0) > 0 || installs.length > 0;
  const repos = installs.flatMap((i) => i.repos.map((r) => ({ ...r, full: i.account + "/" + r.name })));
  const scanned = repos.some((r) => r.scan === "done");
  const set = (full: string, a: RepoAction) => setActions((prev) => ({ ...prev, [full]: a }));

  const rescan = async (full: string) => {
    set(full, { busy: "scan" });
    try {
      await api(`/v1/repos/${full}/scan`, { method: "POST", body: {} });
      set(full, { message: "Scanning… the code map appears in under a minute." });
      inst.reload();
    } catch {
      set(full, { message: "Could not start the scan." });
    }
  };
  const setup = async (full: string) => {
    set(full, { busy: "setup", message: "Reading the repository and preparing the PR (up to a minute)…" });
    try {
      const r = await api<{ url: string; number: number; created: boolean; wrapped: number }>(`/v1/repos/${full}/setup-pr`, { method: "POST", body: {} });
      set(full, {
        prUrl: r.url,
        message: r.number
          ? (r.created ? "Opened" : "Already open:") + " setup PR #" + r.number + (r.wrapped ? " (" + r.wrapped + " API reads wrapped)" : "")
          : "Nothing to set up: this repo is already wired.",
      });
    } catch {
      set(full, { message: "Could not open the setup PR. Check the GitHub App logs." });
    }
  };

  return (
    <main className="min-h-screen bg-dash-bg px-6 py-10 text-text-primary dark:bg-dark-dash-bg dark:text-white">
      <div className="mx-auto max-w-3xl space-y-6">
        <Logo href="/app" />
        <div>
          <h1 className="font-aeonik text-3xl tracking-tight md:text-4xl">Set up Seismo</h1>
          <p className="mt-2 font-aeonik-light text-sm text-text-primary/70 dark:text-white/70">
            Four steps. Seismo reads your code through the GitHub App and your API traffic through the SDK; it never changes code
            without a pull request you merge.
          </p>
        </div>

        <Step n={1} title="Sign in with GitHub" done={!!me.data}>
          <p className="font-aeonik-light text-sm text-text-primary/70 dark:text-white/70">{me.data ? "Signed in as " + me.data.login + "." : "Checking…"}</p>
        </Step>

        <Step n={2} title="Install the Seismo GitHub App" done={installed}>
          {installed ? (
            <p className="font-aeonik-light text-sm text-text-primary/70 dark:text-white/70">
              Installed on {installs.map((i) => i.account).join(", ") || "your account"}.{" "}
              {me.data?.installUrl && (
                <a href={me.data.installUrl} className="text-accent underline-offset-4 hover:underline">
                  Add repositories ↗
                </a>
              )}
            </p>
          ) : (
            <div className="space-y-3">
              <p className="font-aeonik-light text-sm text-text-primary/70 dark:text-white/70">
                Pick the repositories that call third-party APIs. Seismo maps where your code reads each response field.
              </p>
              {me.data?.installUrl && (
                <a href={me.data.installUrl} className={PRIMARY}>
                  Install on GitHub ↗
                </a>
              )}
            </div>
          )}
        </Step>

        <Step n={3} title="Map your code" done={scanned}>
          {repos.length === 0 ? (
            <p className="font-aeonik-light text-sm text-text-primary/60 dark:text-white/60">Repositories appear here after the install.</p>
          ) : (
            <ul className="divide-y divide-box-outline/50 dark:divide-dark-border/50">
              {repos.map((r) => {
                const a = actions[r.full] ?? {};
                return (
                  <li key={r.full} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-aeonik-mono text-sm">
                        {r.full}
                        <span
                          className={
                            "ml-3 text-[11px] uppercase tracking-wider " +
                            (r.scan === "done" ? "text-ok dark:text-ok-bright" : r.scan === "running" ? "text-warn dark:text-warn-bright" : "text-text-primary/50 dark:text-white/45")
                          }
                        >
                          {r.scan === "done" ? "mapped" : r.scan === "running" ? "scanning…" : "not scanned"}
                        </span>
                      </span>
                      <span className="flex gap-2">
                        <button type="button" className={BUTTON} disabled={!!a.busy} onClick={() => rescan(r.full)}>
                          {r.scan === "done" ? "Rescan" : "Scan"}
                        </button>
                        <button type="button" className={BUTTON} disabled={!!a.busy} onClick={() => setup(r.full)}>
                          Open setup PR
                        </button>
                      </span>
                    </div>
                    {a.message && (
                      <p className="mt-1 font-aeonik-light text-xs text-text-primary/60 dark:text-white/60">
                        {a.message}{" "}
                        {a.prUrl && (
                          <a href={a.prUrl} target="_blank" rel="noreferrer" className="text-accent underline-offset-4 hover:underline">
                            View PR ↗
                          </a>
                        )}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 font-aeonik-light text-xs text-text-primary/50 dark:text-white/45">
            The setup PR wraps your API reads with <code className="font-aeonik-mono">withAliases()</code> and adds an empty{" "}
            <code className="font-aeonik-mono">seismo/aliases.json</code>. Behaviour does not change until a fix rule is merged.
          </p>
        </Step>

        <Step n={4} title="Send traffic with the SDK" done={false}>
          <p className="font-aeonik-light text-sm text-text-primary/70 dark:text-white/70">
            Create an SDK key, then follow the 2-minute guide.{" "}
            <Link href="/app/settings" className="text-accent underline-offset-4 hover:underline">
              Create a key ↗
            </Link>{" "}
            ·{" "}
            <Link href="/docs/sdk" className="text-accent underline-offset-4 hover:underline">
              SDK guide ↗
            </Link>
          </p>
        </Step>

        <Link href="/app" className={PRIMARY}>
          Open the dashboard →
        </Link>
      </div>
    </main>
  );
}
