"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/dashboard/Card";
import ShapeDiff from "@/components/dashboard/ShapeDiff";
import { REVIEW_REASONS, type ReviewItem } from "@/lib/mock/review";
import AiPanel from "./AiPanel";
import SuggestionPanel from "./SuggestionPanel";
import ReviewActions from "./ReviewActions";

interface ReviewCardProps {
  item: ReviewItem;
  aiOn: boolean;
  expanded: boolean;
  prNumber?: number;
  prUrl?: string;
  error?: string;
  onToggle: () => void;
  onMarkExpected: () => void;
  onSnooze: (label: string) => void;
  onOpenPr: () => void;
}

/** Always-visible part: who, what, why a human is needed. Click to open or close the card. */
function Summary({ item, expanded, onToggle }: Pick<ReviewCardProps, "item" | "expanded" | "onToggle">) {
  const reason = REVIEW_REASONS[item.reason];
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="block w-full p-5 text-left transition-colors hover:bg-dash-bg/30 dark:hover:bg-white/[0.02] md:p-6"
    >
      <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="font-aeonik text-sm font-semibold tracking-tight text-text-primary dark:text-white">
            {item.service}
          </span>
          <span className="rounded border border-box-outline/50 bg-dash-bg/80 px-2 py-0.5 font-aeonik-mono text-xs text-text-primary/70 dark:border-dark-border/50 dark:bg-white/[0.04] dark:text-white/70">
            <span className="mr-1.5 font-semibold text-ok dark:text-ok-bright">{item.method}</span>
            {item.endpoint}
          </span>
          <span title={"Detector " + item.detectorId} className="font-aeonik-mono text-[10px] text-text-primary/50 dark:text-white/45">
            {item.detectorName} · {item.confidence}% sure
          </span>
        </span>

        <span className="flex items-center gap-3 font-aeonik-mono text-xs">
          <span className="text-text-primary/50 dark:text-white/45">{item.detectedAt}</span>
          <span
            title={reason.why}
            className="rounded border border-warn/30 bg-warn/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-warn dark:border-warn-bright/30 dark:bg-warn-bright/10 dark:text-warn-bright"
          >
            {reason.label}
          </span>
          <span
            aria-hidden
            className={cn("text-[10px] text-text-primary/50 transition-transform dark:text-white/45", expanded && "rotate-180")}
          >
            ▼
          </span>
        </span>
      </span>

      <span className="mt-3 block font-aeonik text-xl font-medium tracking-tight text-text-primary md:text-2xl dark:text-white">
        {item.title}
      </span>

      {!expanded && (
        <span className="mt-2 block truncate font-aeonik-mono text-[11px] text-text-primary/50 dark:text-white/45">
          {item.before} → {item.after}
        </span>
      )}
    </button>
  );
}

function Details({ item, aiOn, prNumber, prUrl, error, onMarkExpected, onSnooze, onOpenPr }: Omit<ReviewCardProps, "expanded" | "onToggle">) {
  return (
    <div className="border-t border-box-outline/50 px-5 pb-5 pt-5 dark:border-dark-border/50 md:px-6 md:pb-6">
      <ShapeDiff split before={item.before} after={item.after} />

      <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
        <AiPanel item={item} aiOn={aiOn} />
        <SuggestionPanel suggestion={item.suggestion} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-1.5 border-t border-box-outline/50 pt-4 font-aeonik-mono text-xs dark:border-dark-border/50">
        <span className="text-[11px] text-text-primary/50 dark:text-white/45">IMPACT</span>
        {item.impactedWorkflows.map((wf) => (
          <span
            key={wf}
            className="rounded border border-box-outline/40 bg-dash-bg/80 px-2 py-0.5 text-[11px] text-text-primary/70 dark:border-dark-border/40 dark:bg-white/[0.04] dark:text-white/70"
          >
            {wf}
          </span>
        ))}
        <Link
          href={"/app/drift/" + item.driftId}
          className="ml-auto text-[11px] uppercase tracking-wider text-text-primary/60 underline-offset-4 hover:text-text-primary hover:underline dark:text-white/60 dark:hover:text-white"
        >
          See the change ↗
        </Link>
      </div>

      <div className="mt-4">
        <ReviewActions canOpenPr={item.suggestion.kind === "transform" && !!item.suggestion.rule} prNumber={prNumber} prUrl={prUrl} error={error} onMarkExpected={onMarkExpected} onSnooze={onSnooze} onOpenPr={onOpenPr} />
      </div>
    </div>
  );
}

/** One change that needs a human. Collapsed it is a headline; open it has the evidence, the why, the suggestion and the actions. */
export default function ReviewCard({ expanded, onToggle, ...rest }: ReviewCardProps) {
  return (
    <Card as="article">
      <Summary item={rest.item} expanded={expanded} onToggle={onToggle} />
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <Details {...rest} />
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
