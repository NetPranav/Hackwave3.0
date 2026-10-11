import type { TimelineDeployMarker } from "@/lib/mock/timeline";

/** A deploy is a landmark, not an event: a quiet row so you can see what shipped just before a change. */
export default function DeployRow({ deploy }: { deploy: TimelineDeployMarker }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-box-outline/70 bg-dash-bg/40 px-4 py-2.5 font-aeonik-mono text-xs text-text-primary/80 dark:border-dark-border/70 dark:bg-white/[0.02] dark:text-white/80">
      <div className="flex min-w-0 items-center gap-2">
        <span className="rounded border border-box-outline/60 bg-section px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-primary dark:border-dark-border/60 dark:bg-white/[0.06] dark:text-white">
          Deploy
        </span>
        <span className="font-semibold text-text-primary dark:text-white">{deploy.commitHash}</span>
        <span className="truncate text-text-primary/70 dark:text-white/70">{deploy.commitMessage}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-text-primary/50 dark:text-white/45">
        <span>{deploy.relativeTime}</span>
        <span>by @{deploy.author}</span>
      </div>
    </div>
  );
}
