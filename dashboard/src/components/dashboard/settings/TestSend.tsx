"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { api, USE_MOCKS } from "@/lib/api/live";
import type { Channel, NotificationApi } from "@/lib/api/types";

type Phase = "idle" | "sending" | "sent" | "failed";

interface TestSendProps {
  channelName: string;
  /** engine channels this card covers (Slack / Discord share one card) */
  channels?: Channel[];
  disabled: boolean;
  disabledReason: string;
}

/** Send test button: POST /v1/notifications/test (every enabled channel gets one marked test); shows this channel's result. */
export default function TestSend({ channelName, channels = [], disabled, disabledReason }: TestSendProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [detail, setDetail] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const send = () => {
    setPhase("sending");
    if (USE_MOCKS) {
      timer.current = setTimeout(() => setPhase("sent"), 900);
      return;
    }
    // give the settings a moment to save first (they save 600 ms after the last edit)
    timer.current = setTimeout(() => {
      api<{ sent: NotificationApi[] }>("/v1/notifications/test", { method: "POST", body: {} })
        .then(({ sent }) => {
          const mine = sent.filter((n) => channels.includes(n.channel));
          const failed = mine.find((n) => !n.ok);
          if (failed) {
            setPhase("failed");
            setDetail(failed.error ?? "failed");
          } else if (!mine.length && channels.length) {
            setPhase("failed");
            setDetail("Nothing was sent to this channel: check that it is on and filled in.");
          } else setPhase("sent");
        })
        .catch(() => {
          setPhase("failed");
          setDetail("The backend did not answer.");
        });
    }, 800);
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
          phase === "sent" ? "text-ok dark:text-ok-bright" : phase === "failed" ? "text-warn dark:text-warn-bright" : "text-text-primary/50 dark:text-white/45"
        )}
      >
        {disabled
          ? disabledReason
          : phase === "sent"
            ? "✓ Test to " + channelName + " sent" + (USE_MOCKS ? " (simulated in mock mode)" : "")
            : phase === "failed"
              ? "✗ " + detail
              : "Sends one clearly marked test message."}
      </p>
    </div>
  );
}
