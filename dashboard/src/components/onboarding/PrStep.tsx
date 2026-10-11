"use client";

import { useState } from "react";
import { useOnboarding } from "@/lib/api/onboarding";

const PRIMARY =
  "rounded-md bg-btn-primary px-5 py-2.5 font-aeonik-mono text-xs uppercase tracking-wider text-white transition-transform hover:scale-[1.02]";
const QUIET =
  "font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/60 underline-offset-4 hover:text-text-primary hover:underline";

interface PrStepProps {
  onNext: () => void;
  onSkip: () => void;
}

/** The one-time setup PR. It only adds files, and a person merges it. */
export default function PrStep({ onNext, onSkip }: PrStepProps) {
  const o = useOnboarding();
  const [pr, setPr] = useState<{ number: number; url: string; title: string } | null>(null);
  const [state, setState] = useState<"idle" | "opening" | "failed" | "none">("idle");
  const [rulesUrl, setRulesUrl] = useState("");
  const open = async () => {
    setState("opening");
    try {
      const r = await o.openSetupPr();
      if (!r.number) {
        setRulesUrl(r.url);
        return setState("none");
      }
      setPr(r);
      setState("idle");
    } catch {
      setState("failed");
    }
  };
  if (!pr)
    return (
      <div className="rounded-md border border-box-outline bg-section p-5">
        <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50">Setup pull request</p>
        <p className="mt-2 font-aeonik-light text-sm text-text-primary/60">
          {state === "none"
            ? "Already set up: every API read goes through withAliases() and seismo/aliases.json exists (the setup PR was merged earlier). Fix PRs add their rules there."
            : state === "failed"
              ? "Could not open the pull request. Check that the GitHub App is running."
              : "Seismo reads the repo and opens one pull request that wraps your API reads with withAliases() and adds seismo/aliases.json. It does not change how your app behaves."}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          {state === "none" ? (
            <>
              <button type="button" onClick={onNext} className={PRIMARY}>
                Continue
              </button>
              {rulesUrl && (
                <a href={rulesUrl} target="_blank" rel="noopener noreferrer" className={QUIET}>
                  See seismo/aliases.json ↗
                </a>
              )}
            </>
          ) : (
            <button type="button" onClick={open} disabled={state === "opening"} className={PRIMARY}>
              {state === "opening" ? "Preparing… (up to a minute)" : "Open the pull request"}
            </button>
          )}
          <button type="button" onClick={onSkip} className={QUIET}>
            Skip for now
          </button>
        </div>
      </div>
    );
  const SETUP_PR = pr;
  return (
    <div className="rounded-md border border-box-outline bg-section p-5">
      <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50">Pull request #{SETUP_PR.number}</p>
      <p className="mt-2 font-aeonik text-base">{SETUP_PR.title}</p>
      <p className="mt-2 font-aeonik-light text-sm text-text-primary/60">
        This prepares the one file that later fixes use, <code className="font-aeonik-mono text-[0.9em]">seismo/aliases.json</code>. It does not change how your app behaves.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <a href={SETUP_PR.url} target="_blank" rel="noopener noreferrer" className={PRIMARY}>
          Open on GitHub ↗
        </a>
        <button type="button" onClick={onNext} className={QUIET}>
          I merged it
        </button>
        <button type="button" onClick={onSkip} className={QUIET}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
