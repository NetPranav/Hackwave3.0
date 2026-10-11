import { cn } from "@/lib/utils";
import type { DriftState } from "@/lib/mock/status";

export type StateTone = "accent" | "warn" | "ok" | "muted";

export const STATE_META: Record<DriftState, { label: string; tone: StateTone; rank: number }> = {
  changed: { label: "CHANGED", tone: "accent", rank: 0 },
  under_review: { label: "REVIEW", tone: "warn", rank: 1 },
  fix_pending: { label: "FIX READY", tone: "ok", rank: 2 },
  normal: { label: "NORMAL", tone: "muted", rank: 3 },
};

export const DOT_CLASS: Record<StateTone, string> = {
  accent: "bg-accent",
  warn: "bg-warn dark:bg-warn-bright",
  ok: "bg-ok dark:bg-ok-bright",
  muted: "bg-ok/60 dark:bg-ok-bright/60",
};

export const TEXT_CLASS: Record<StateTone, string> = {
  accent: "text-accent",
  warn: "text-warn dark:text-warn-bright",
  ok: "text-ok dark:text-ok-bright",
  muted: "text-text-primary/50 dark:text-white/45",
};

/** State word with a dot. Orange = drift needing action, amber = human review, green = fix ready, grey = nominal. */
export default function StateLabel({ state, className }: { state: DriftState; className?: string }) {
  const meta = STATE_META[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-aeonik-mono text-[10px] font-medium uppercase tracking-wider",
        TEXT_CLASS[meta.tone],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASS[meta.tone], meta.tone === "accent" && "animate-pulse")} />
      {meta.label}
    </span>
  );
}
