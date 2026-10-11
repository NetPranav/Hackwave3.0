"use client";

import { useEffect, useState } from "react";
import { SCAN_RESULT } from "@/lib/mock/onboarding";

const DURATION_MS = 3600;
const TICK_MS = 80;

const PRIMARY =
  "rounded-md bg-btn-primary px-5 py-2.5 font-aeonik-mono text-xs uppercase tracking-wider text-white transition-transform hover:scale-[1.02]";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50">{label}</p>
      <p className="mt-1 font-aeonik text-3xl tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

/** Mock scan: the numbers count up, then it says plainly how much could not be followed. */
export default function ScanStep({ onNext }: { onNext: () => void }) {
  const [progress, setProgress] = useState(0);
  const finished = progress >= 1;

  useEffect(() => {
    const timer = window.setInterval(() => setProgress((p) => Math.min(1, p + TICK_MS / DURATION_MS)), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const part = (n: number) => Math.round(n * progress);

  return (
    <div className="rounded-md border border-box-outline bg-section p-5">
      <div className="flex items-center justify-between font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50">
        <span>{finished ? "Scan finished" : "Reading your code…"}</span>
        <span className="tabular-nums">{Math.round(progress * 100)}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-inset" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full origin-left rounded-full bg-accent transition-transform duration-100" style={{ transform: "scaleX(" + progress + ")" }} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
        <Stat label="Files read" value={part(SCAN_RESULT.files)} />
        <Stat label="API calls" value={part(SCAN_RESULT.apiCalls)} />
        <Stat label="Fields mapped" value={part(SCAN_RESULT.fieldsMapped)} />
        <Stat label="Services" value={part(SCAN_RESULT.services)} />
      </div>

      {finished && (
        <>
          <p className="mt-5 border-l-2 border-accent/60 pl-3 font-aeonik-light text-sm text-text-primary/70">
            {SCAN_RESULT.unresolvedCalls} calls build their field names on the fly, so we cannot follow them automatically. They are marked in the graph, not hidden.
          </p>
          <button type="button" onClick={onNext} className={PRIMARY + " mt-5"}>
            Continue
          </button>
        </>
      )}
    </div>
  );
}
