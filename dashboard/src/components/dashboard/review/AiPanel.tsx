"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { ReviewItem } from "@/lib/mock/review";

/** Why it matters, in plain words. Shows the model and latency, or "template" when AI is off. */
export default function AiPanel({ item, aiOn }: { item: ReviewItem; aiOn: boolean }) {
  const text = aiOn ? item.aiExplanation : item.templateExplanation;
  const badge = aiOn ? "AI · " + (item.aiLatencyMs / 1000).toFixed(1) + "s" : "STANDARD TEXT · AI OFF";

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45">
          Why it matters
        </h4>
        <span
          title={aiOn ? item.aiModel : "AI is switched off"}
          className={cn(
            "rounded border px-2 py-0.5 font-aeonik-mono text-[10px] uppercase tracking-wider",
            aiOn
              ? "border-box-outline text-text-primary/60 dark:border-dark-border dark:text-white/60"
              : "border-warn/30 bg-warn/10 text-warn dark:border-warn-bright/30 dark:bg-warn-bright/10 dark:text-warn-bright"
          )}
        >
          {badge}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={aiOn ? "ai" : "template"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="mt-3 font-aeonik-light text-sm leading-relaxed text-text-primary/80 dark:text-white/80"
        >
          {text}
        </motion.p>
      </AnimatePresence>

      <p className="mt-3 font-aeonik-mono text-[10px] text-text-primary/40 dark:text-white/40">
        The AI only explains. Finding the change and the suggestion come from fixed rules, not AI.
      </p>
    </section>
  );
}
