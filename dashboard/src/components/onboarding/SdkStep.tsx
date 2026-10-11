"use client";

import { useState } from "react";
import CodeBlock from "@/components/docs/CodeBlock";
import { useOnboarding } from "@/lib/api/onboarding";

const INSTALL = "npm install @seismo/sdk";
const INIT = `import { seismo } from "@seismo/sdk";

seismo.init({ key: process.env.SEISMO_KEY });`;

const PRIMARY =
  "rounded-md bg-btn-primary px-5 py-2.5 font-aeonik-mono text-xs uppercase tracking-wider text-white transition-transform hover:scale-[1.02] disabled:opacity-60";
const QUIET =
  "font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/60 underline-offset-4 hover:text-text-primary hover:underline";

type Check = "idle" | "waiting" | "ok";

interface SdkStepProps {
  onNext: () => void;
  onSkip: () => void;
}

/** Two short code boxes, a real project key (shown once), and a check that waits for the first fingerprint. */
export default function SdkStep({ onNext, onSkip }: SdkStepProps) {
  const o = useOnboarding();
  const [waiting, setWaiting] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [keyError, setKeyError] = useState("");
  const FIRST_TRAFFIC = o.traffic;
  const check: Check = waiting && FIRST_TRAFFIC ? "ok" : waiting ? "waiting" : "idle";
  const SDK_KEY = o.key;
  const SDK_KEY_MASKED = SDK_KEY ? SDK_KEY.slice(0, 7) + "••••••••••••" + SDK_KEY.slice(-4) : "No key yet";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <CodeBlock title="terminal" code={INSTALL} />
        <CodeBlock title="server code" code={INIT} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-box-outline bg-section px-4 py-3">
        <div>
          <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50">Your SEISMO_KEY</p>
          <p className="mt-1 break-all font-aeonik-mono text-sm">{reveal && SDK_KEY ? SDK_KEY : SDK_KEY_MASKED}</p>
          {SDK_KEY && <p className="mt-1 font-aeonik-light text-xs text-text-primary/50">Copy it now: it is shown only this once.</p>}
          {keyError && <p className="mt-1 font-aeonik-light text-xs text-accent">{keyError}</p>}
        </div>
        {SDK_KEY ? (
          <button type="button" onClick={() => setReveal((v) => !v)} className={QUIET}>
            {reveal ? "Hide" : "Show"}
          </button>
        ) : (
          <button type="button" onClick={() => o.createKey().catch(() => setKeyError("Could not create a key (only the project owner can)."))} className={QUIET}>
            Create key
          </button>
        )}
      </div>

      <div className="rounded-md border border-box-outline bg-section p-5">
        {check === "ok" ? (
          <p className="font-aeonik text-base">
            <span className="mr-2 text-accent">●</span>
            First traffic received: {FIRST_TRAFFIC?.calls} calls/min from {FIRST_TRAFFIC?.source}.
          </p>
        ) : (
          <p className="font-aeonik-light text-sm text-text-primary/70">
            {check === "waiting" ? "Waiting for your app to make its first API call…" : "Deploy, then check that Seismo can hear your app."}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {check === "ok" ? (
            <button type="button" onClick={onNext} className={PRIMARY}>
              Continue
            </button>
          ) : (
            <>
              <button type="button" onClick={() => setWaiting(true)} disabled={check === "waiting"} className={PRIMARY}>
                {check === "waiting" ? "Checking…" : "Check connection"}
              </button>
              <button type="button" onClick={onSkip} className={QUIET}>
                Skip for now
              </button>
            </>
          )}
        </div>
        {check !== "ok" && <p className="mt-3 font-aeonik-light text-xs text-text-primary/50">Without the SDK you still get the code map. Live monitoring needs it.</p>}
      </div>
    </div>
  );
}
