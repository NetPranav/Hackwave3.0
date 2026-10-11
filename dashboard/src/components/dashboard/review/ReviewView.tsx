"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Card, CardHeader } from "@/components/dashboard/Card";
import { REVIEW_ITEMS } from "@/lib/mock/review";
import DecisionBar from "./DecisionBar";
import ReviewCard from "./ReviewCard";
import HandledRow from "./HandledRow";
import type { ReviewEntry } from "./types";

const FIRST_MOCK_PR = 110;

function AllClear() {
  return (
    <Card className="px-5 py-12 text-center">
      <p className="font-aeonik text-base font-medium text-text-primary dark:text-white">All clear</p>
      <p className="mt-1 font-aeonik-light text-sm text-text-primary/60 dark:text-white/60">
        Nothing needs a human decision right now.
      </p>
      <Link
        href="/app/timeline"
        className="mt-4 inline-block font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/70 underline-offset-4 hover:text-text-primary hover:underline dark:text-white/70 dark:hover:text-white"
      >
        See the timeline ↗
      </Link>
    </Card>
  );
}

/** Review queue: every change Seismo will not fix by itself, with the evidence to decide. */
export default function ReviewView() {
  const [aiOn, setAiOn] = useState(true);
  const [entries, setEntries] = useState<Record<string, ReviewEntry>>({});

  const [expandedId, setExpandedId] = useState<string | null>(REVIEW_ITEMS[0].id);

  const entryOf = (id: string): ReviewEntry => entries[id] ?? { status: "open" };
  const update = (id: string, patch: Partial<ReviewEntry>) =>
    setEntries((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { status: "open" }), ...patch } }));

  const open = REVIEW_ITEMS.filter((i) => entryOf(i.id).status === "open");
  const handled = REVIEW_ITEMS.filter((i) => entryOf(i.id).status !== "open");

  /** Resolve a card, then open the next waiting one so the reviewer keeps moving. */
  const resolve = (id: string, patch: Partial<ReviewEntry>) => {
    update(id, patch);
    if (expandedId === id) setExpandedId(open.find((i) => i.id !== id)?.id ?? null);
  };

  return (
    <main className="mx-auto max-w-[1440px] space-y-6 px-6 py-6 md:px-10 lg:px-16">
      <DecisionBar open={open} aiOn={aiOn} onToggleAi={() => setAiOn((v) => !v)} />

      {open.length === 0 ? (
        <AllClear />
      ) : (
        <div className="space-y-6">
          <AnimatePresence mode="popLayout" initial={false}>
            {open.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <ReviewCard
                  item={item}
                  aiOn={aiOn}
                  expanded={expandedId === item.id}
                  onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  prNumber={entryOf(item.id).prNumber}
                  onMarkExpected={() => resolve(item.id, { status: "expected" })}
                  onSnooze={(label) => resolve(item.id, { status: "snoozed", snoozeLabel: label })}
                  onOpenPr={() => update(item.id, { prNumber: FIRST_MOCK_PR + REVIEW_ITEMS.indexOf(item) })}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {handled.length > 0 && (
        <Card>
          <CardHeader title={"Handled · " + handled.length} />
          <ul className="divide-y divide-box-outline/50 dark:divide-dark-border/50">
            {handled.map((item) => (
              <HandledRow
                key={item.id}
                item={item}
                entry={entryOf(item.id)}
                onUndo={() => update(item.id, { status: "open", snoozeLabel: undefined })}
              />
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
