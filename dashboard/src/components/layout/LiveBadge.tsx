"use client";

import { USE_MOCKS, useLiveContext } from "@/lib/api/live";

/** v2-P1.4: LIVE when the event stream to the backend is open, OFFLINE when it is not, MOCK in mock mode. */
export default function LiveBadge() {
  const { connected } = useLiveContext();
  const label = USE_MOCKS ? "MOCK" : connected ? "LIVE" : "OFFLINE";
  const dot = USE_MOCKS ? "bg-warn dark:bg-warn-bright" : connected ? "animate-pulse bg-ok dark:bg-ok-bright" : "bg-bad dark:bg-bad-bright";
  return (
    <div
      className="hidden items-center gap-1.5 font-aeonik-mono text-[10px] text-text-primary/60 dark:text-white/60 sm:flex"
      title={USE_MOCKS ? "Mock data (NEXT_PUBLIC_USE_MOCKS=1)" : connected ? "Connected to the Seismo backend" : "Backend unreachable, retrying"}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span>{label}</span>
    </div>
  );
}
