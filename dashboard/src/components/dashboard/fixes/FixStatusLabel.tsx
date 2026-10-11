import { cn } from "@/lib/utils";
import type { FixRuleData } from "@/lib/mock/fixes";

const BASE = "inline-flex items-center gap-1.5 font-aeonik-mono text-[10px] font-medium uppercase tracking-wider";

/** Status word for a fix rule: orange = needs a human, green = safe or done, amber = human review. */
export default function FixStatusLabel({ fix }: { fix: FixRuleData }) {
  switch (fix.status) {
    case "pr_open":
      return (
        <span className={cn(BASE, "text-accent")}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          PR #{fix.fixPrNumber}
        </span>
      );
    case "ci_green":
      return (
        <span className={cn(BASE, "text-ok dark:text-ok-bright")}>
          <span className="h-1.5 w-1.5 rounded-full bg-ok dark:bg-ok-bright" />
          CI GREEN
        </span>
      );
    case "merged":
      return (
        <span className={cn(BASE, "text-text-primary/50 dark:text-white/45")}>
          <span aria-hidden>✓</span>
          MERGED
        </span>
      );
    case "safety_blocked":
      return (
        <span className={cn(BASE, "text-warn dark:text-warn-bright")}>
          <span className="h-1.5 w-1.5 rounded-full bg-warn dark:bg-warn-bright" />
          REVIEW
        </span>
      );
  }
}
