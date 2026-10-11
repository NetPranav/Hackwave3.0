"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SNOOZE_OPTIONS } from "./types";

const PRIMARY =
  "inline-flex items-center gap-1.5 rounded border border-btn-primary bg-btn-primary px-3 py-1.5 font-aeonik-mono text-xs uppercase tracking-wider text-white transition-colors hover:border-accent hover:bg-accent dark:border-dark-btn-primary dark:bg-dark-btn-primary";
const QUIET =
  "inline-flex items-center gap-1.5 rounded border border-box-outline px-3 py-1.5 font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/80 transition-colors hover:border-text-primary hover:text-text-primary dark:border-dark-border dark:text-white/80 dark:hover:text-white";

interface ReviewActionsProps {
  prNumber?: number;
  onMarkExpected: () => void;
  onSnooze: (label: string) => void;
  onOpenPr: () => void;
}

/** Mark expected, snooze, or open a needs-review suggestion PR. The PR is never merged automatically. */
export default function ReviewActions({ prNumber, onMarkExpected, onSnooze, onOpenPr }: ReviewActionsProps) {
  const [snoozing, setSnoozing] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={onMarkExpected} className={PRIMARY}>
        <span aria-hidden>✓</span>
        Mark expected
      </button>

      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => setSnoozing((v) => !v)} aria-expanded={snoozing} className={QUIET}>
          Snooze
          <span aria-hidden className="text-[9px]">
            {snoozing ? "▲" : "▼"}
          </span>
        </button>
        <AnimatePresence initial={false}>
          {snoozing && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex items-center gap-1.5"
            >
              {SNOOZE_OPTIONS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setSnoozing(false);
                    onSnooze(label);
                  }}
                  className="rounded border border-box-outline px-2 py-1 font-aeonik-mono text-[11px] text-text-primary/70 transition-colors hover:border-text-primary hover:text-text-primary dark:border-dark-border dark:text-white/70 dark:hover:text-white"
                >
                  {label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {prNumber ? (
        <a
          href={"https://github.com/NetPranav/seismo-demo-shop/pull/" + prNumber}
          target="_blank"
          rel="noreferrer"
          className="ml-auto font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/70 underline-offset-4 hover:text-text-primary hover:underline dark:text-white/70 dark:hover:text-white"
        >
          PR #{prNumber} · needs review ↗
        </a>
      ) : (
        <button type="button" onClick={onOpenPr} className={QUIET + " ml-auto"}>
          Open suggestion PR ↗
        </button>
      )}
    </div>
  );
}
