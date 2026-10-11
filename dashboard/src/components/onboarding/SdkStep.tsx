"use client";

import { useEffect, useState } from "react";
import CodeBlock from "@/components/docs/CodeBlock";
import { FIRST_TRAFFIC, SDK_KEY_DEMO, SDK_KEY_MASKED } from "@/lib/mock/onboarding";

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

/** Two short code boxes, the project key, and a check that waits for the first call. The check is mocked for now. */
export default function SdkStep({ onNext, onSkip }: SdkStepProps) {
  const [check, setCheck] = useState<Check>("idle");
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    if (check !== "waiting") return;
    const timer = window.setTimeout(() => setCheck("ok"), 1800);
    return () => window.clearTimeout(timer);
  }, [check]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <CodeBlock title="terminal" code={INSTALL} />
        <CodeBlock title="server code" code={INIT} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-box-outline bg-section px-4 py-3">
        <div>
          <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50">Your SEISMO_KEY</p>
          <p className="mt-1 font-aeonik-mono text-sm">{reveal ? SDK_KEY_DEMO : SDK_KEY_MASKED}</p>
        </div>
        <button type="button" onClick={() => setReveal((v) => !v)} className={QUIET}>
          {reveal ? "Hide" : "Show"}
        </button>
      </div>

      <div className="rounded-md border border-box-outline bg-section p-5">
        {check === "ok" ? (
          <p className="font-aeonik text-base">
            <span className="mr-2 text-accent">●</span>
            First traffic received: {FIRST_TRAFFIC.calls} calls from {FIRST_TRAFFIC.source}.
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
              <button type="button" onClick={() => setCheck("waiting")} disabled={check === "waiting"} className={PRIMARY}>
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
