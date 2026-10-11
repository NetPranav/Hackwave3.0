import type { ReviewItem } from "@/lib/mock/review";
import type { ReviewEntry } from "./types";

/** A change that has been dealt with: one quiet line and an undo. */
export default function HandledRow({ item, entry, onUndo }: { item: ReviewItem; entry: ReviewEntry; onUndo: () => void }) {
  const outcome = entry.status === "expected" ? "Marked expected" : "Snoozed " + (entry.snoozeLabel ?? "");

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 font-aeonik-mono text-xs">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className={
            entry.status === "expected"
              ? "text-ok dark:text-ok-bright"
              : "text-text-primary/40 dark:text-white/40"
          }
        >
          {entry.status === "expected" ? "✓" : "◷"}
        </span>
        <span className="truncate font-medium text-text-primary dark:text-white">{item.title}</span>
        <span className="hidden text-text-primary/50 dark:text-white/45 sm:inline">{item.service}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-text-primary/60 dark:text-white/60">
          {outcome}
          {entry.prNumber ? " · PR #" + entry.prNumber : ""}
        </span>
        <button
          type="button"
          onClick={onUndo}
          className="uppercase tracking-wider text-text-primary/60 underline-offset-4 hover:text-text-primary hover:underline dark:text-white/60 dark:hover:text-white"
        >
          Undo
        </button>
      </div>
    </li>
  );
}
