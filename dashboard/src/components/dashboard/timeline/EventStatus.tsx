import { cn } from "@/lib/utils";
import type { EventSeverity, EventState } from "@/lib/mock/timeline";

export const SEVERITY: Record<EventSeverity, { label: string; text: string; dot: string }> = {
  breaking: { label: "BREAKING", text: "text-accent", dot: "bg-accent animate-pulse" },
  suspected: { label: "SUSPECTED", text: "text-warn dark:text-warn-bright", dot: "bg-warn dark:bg-warn-bright" },
  info: { label: "INFO", text: "text-text-primary/50 dark:text-white/45", dot: "bg-text-primary/40 dark:bg-white/40" },
  resolved: { label: "RESOLVED", text: "text-text-primary/50 dark:text-white/45", dot: "bg-text-primary/40 dark:bg-white/40" },
};

export const LIFECYCLE: Record<EventState, { label: string; text: string }> = {
  fix_pending: { label: "FIX READY", text: "text-ok dark:text-ok-bright" },
  under_review: { label: "UNDER REVIEW", text: "text-warn dark:text-warn-bright" },
  confirmed: { label: "CONFIRMED", text: "text-text-primary/60 dark:text-white/60" },
  resolved: { label: "RESOLVED", text: "text-text-primary/50 dark:text-white/45" },
};

/** Severity word with a dot. Orange = breaking, amber = suspected, grey = info. */
export function SeverityLabel({ severity, className }: { severity: EventSeverity; className?: string }) {
  const sev = SEVERITY[severity];
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-aeonik-mono text-xs font-medium", sev.text, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", sev.dot)} />
      {sev.label}
    </span>
  );
}

/** Where the event is in its life: fix ready (green), under review (amber), confirmed or resolved (muted). */
export function LifecycleLabel({ state, className }: { state: EventState; className?: string }) {
  const life = LIFECYCLE[state];
  return <span className={cn("font-aeonik-mono text-xs font-medium", life.text, className)}>{life.label}</span>;
}

/** Round node on the timeline spine. */
export function SeverityNode({ severity }: { severity: EventSeverity }) {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-box-outline bg-section dark:border-dark-border dark:bg-dark-dash-section">
      <span className={cn("h-1.5 w-1.5 rounded-full", SEVERITY[severity].dot)} />
    </span>
  );
}
