"use client";

import { useOnboarding } from "@/lib/api/onboarding";

const PRIMARY =
  "rounded-md bg-btn-primary px-5 py-2.5 font-aeonik-mono text-xs uppercase tracking-wider text-white transition-transform hover:scale-[1.02]";

/** The app is installed (GitHub sent the user here). Show what it can read, then continue. */
export default function ConnectStep({ onNext }: { onNext: () => void }) {
  const o = useOnboarding();
  const INSTALLATION = { account: o.account, repos: o.repos, settingsUrl: o.settingsUrl };
  if (!o.loading && !o.installed)
    return (
      <div className="rounded-md border border-box-outline bg-section p-5">
        <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50">Seismo is not installed yet</p>
        <p className="mt-2 font-aeonik-light text-sm text-text-primary/60">Pick the repos that call third-party APIs. GitHub brings you back here.</p>
        <a href={o.installUrl} className={PRIMARY + " mt-5 inline-block"}>
          Install on GitHub ↗
        </a>
      </div>
    );
  return (
    <div className="rounded-md border border-box-outline bg-section p-5">
      <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50">Seismo is installed on</p>
      <p className="mt-2 font-aeonik text-lg">{INSTALLATION.account}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {INSTALLATION.repos.map((repo) => (
          <span key={repo} className="rounded border border-box-outline bg-inset px-2.5 py-1 font-aeonik-mono text-xs text-text-primary/80">
            {INSTALLATION.account}/{repo}
          </span>
        ))}
      </div>
      <p className="mt-4 font-aeonik-light text-sm text-text-primary/60">Seismo can read these repos. It cannot push to your main branch.</p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button type="button" onClick={onNext} className={PRIMARY}>
          Scan my code
        </button>
        <a
          href={INSTALLATION.settingsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/60 underline-offset-4 hover:text-text-primary hover:underline"
        >
          Change repos on GitHub ↗
        </a>
      </div>
    </div>
  );
}
