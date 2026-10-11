"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Phase = "idle" | "sending" | "sent";

interface TestSendProps {
  channelName: string;
  disabled: boolean;
  disabledReason: string;
}

/** Send test button. Simulated here; it will call POST /v1/notifications/test once the API exists. */
export default function TestSend({ channelName, disabled, disabledReason }: TestSendProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const send = () => {
    setPhase("sending");
    timer.current = setTimeout(() => setPhase("sent"), 900);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={send}
        disabled={disabled || phase === "sending"}
        className="inline-flex items-center gap-1.5 rounded border border-btn-primary bg-btn-primary px-3 py-1.5 font-aeonik-mono text-xs uppercase tracking-wider text-white transition-colors hover:border-accent hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-btn-primary disabled:hover:bg-btn-primary dark:border-dark-btn-primary dark:bg-dark-btn-primary"
      >
        {phase === "sending" ? "Sending…" : "Send test"}
      </button>

      <p
        aria-live="polite"
        className={cn(
          "font-aeonik-mono text-[11px]",
          phase === "sent" ? "text-ok dark:text-ok-bright" : "text-text-primary/50 dark:text-white/45"
        )}
      >
        {disabled
          ? disabledReason
          : phase === "sent"
            ? "✓ Test to " + channelName + " sent (simulated in demo mode)"
            : "Sends one clearly marked test message."}
      </p>
    </div>
  );
}
