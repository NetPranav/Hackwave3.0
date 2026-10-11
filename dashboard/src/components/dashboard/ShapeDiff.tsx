import { cn } from "@/lib/utils";

interface ShapeDiffProps {
  before: string;
  after: string;
  label?: string;
  /** Two equal columns with the arrow between, for wide spaces such as the review card. */
  split?: boolean;
  className?: string;
}

const BEFORE_CHIP =
  "rounded border border-bad/25 bg-bad/10 px-2.5 py-1 font-medium text-bad dark:border-bad-bright/25 dark:bg-bad-bright/10 dark:text-bad-bright";
const AFTER_CHIP =
  "rounded border border-ok/25 bg-ok/10 px-2.5 py-1 font-medium text-ok dark:border-ok-bright/25 dark:bg-ok-bright/10 dark:text-ok-bright";

/** A shape change as two chips: what it was (red, minus) and what it is now (green, plus). Never record values. */
export default function ShapeDiff({
  before,
  after,
  label = "Shape change · no record values leave your server",
  split = false,
  className,
}: ShapeDiffProps) {
  return (
    <div
      className={cn(
        "rounded border border-box-outline/70 bg-inset p-3 font-aeonik-mono text-xs dark:border-dark-border dark:bg-dark-inset",
        className
      )}
    >
      <div className="mb-2 text-[10px] uppercase tracking-wider text-text-primary/50 dark:text-white/45">{label}</div>
      <div
        className={cn(
          split ? "grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr] sm:gap-3" : "flex flex-wrap items-center gap-2"
        )}
      >
        <span className={cn(BEFORE_CHIP, split && "px-3 py-2")}>- {before}</span>
        <span aria-hidden className="text-center text-text-primary/40 dark:text-white/40">
          →
        </span>
        <span className={cn(AFTER_CHIP, split && "px-3 py-2")}>+ {after}</span>
      </div>
    </div>
  );
}
