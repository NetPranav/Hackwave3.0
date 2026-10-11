"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Card, CardHeader } from "@/components/dashboard/Card";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import { FIX_PROMISES, SAFETY_CHECKS } from "@/lib/plain";
import type { CheckItem } from "@/lib/mock/fixes";

/** The proof that this fix cannot hurt: eight checks as one row of ticks, four promises underneath. */
export default function SafetyGate({ checks }: { checks: CheckItem[] }) {
  const [openId, setOpenId] = useState<CheckItem["id"] | null>(null);
  const passed = checks.filter((c) => c.passed).length;
  const allPassed = passed === checks.length;
  const open = checks.find((c) => c.id === openId);

  return (
    <Card>
      <CardHeader
        title="Safety checks"
        aside={
          <span
            className={cn(
              "inline-flex items-end gap-1.5 font-aeonik-mono text-xs font-medium",
              allPassed ? "text-ok dark:text-ok-bright" : "text-warn dark:text-warn-bright"
            )}
          >
            <AnimatedNumber value={passed} size={14} weight={500} />
            <span>/ {checks.length} CHECKS PASSED</span>
          </span>
        }
      />

      <div className="px-5 py-4">
        <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
          {checks.map((check) => {
            const isOpen = check.id === openId;
            return (
              <button
                key={check.id}
                type="button"
                onClick={() => setOpenId(isOpen ? null : check.id)}
                aria-expanded={isOpen}
                title={SAFETY_CHECKS[check.id]?.name ?? check.name}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded border px-2 py-2 font-aeonik-mono text-xs transition-colors",
                  isOpen
                    ? "border-text-primary bg-dash-bg/70 dark:border-white dark:bg-white/[0.05]"
                    : "border-box-outline/70 hover:bg-dash-bg/50 dark:border-dark-border dark:hover:bg-white/[0.03]"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "font-bold",
                    check.passed ? "text-ok dark:text-ok-bright" : "text-warn dark:text-warn-bright"
                  )}
                >
                  {check.passed ? "✓" : "!"}
                </span>
                <span className="text-text-primary dark:text-white">{check.id.slice(1)}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 min-h-[2.5rem]">
          <AnimatePresence mode="wait" initial={false}>
            {open ? (
              <motion.div
                key={open.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="rounded border border-box-outline/60 bg-dash-bg/40 px-3 py-2.5 dark:border-dark-border dark:bg-white/[0.02]"
              >
                <p className="font-aeonik-mono text-[11px] font-medium text-text-primary dark:text-white">
                  {open.id.slice(1)}. {SAFETY_CHECKS[open.id]?.name ?? open.name}
                </p>
                <p className="mt-1 font-aeonik-light text-xs leading-relaxed text-text-primary/75 dark:text-white/75">
                  {SAFETY_CHECKS[open.id]?.text}
                </p>
                <p className="mt-2 font-aeonik-mono text-[10px] text-text-primary/45 dark:text-white/40">
                  Detail for this fix: {open.evidence}
                </p>
              </motion.div>
            ) : (
              <motion.p
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="px-1 py-2 font-aeonik-light text-xs text-text-primary/50 dark:text-white/45"
              >
                Every check must pass before Seismo opens an automatic PR. Pick one to see what it means.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <dl className="grid grid-cols-1 divide-y divide-box-outline/50 border-t border-box-outline dark:divide-dark-border/50 dark:border-dark-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {FIX_PROMISES.map((g) => (
          <div key={g.id} className="px-5 py-3">
            <dt title={g.id} className="flex items-center gap-1.5 font-aeonik-mono text-xs font-medium text-text-primary dark:text-white">
              <span aria-hidden className="text-ok dark:text-ok-bright">
                ✓
              </span>
              <span>{g.name}</span>
            </dt>
            <dd className="mt-1 font-aeonik-light text-[11px] leading-relaxed text-text-primary/60 dark:text-white/60">
              {g.text}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
