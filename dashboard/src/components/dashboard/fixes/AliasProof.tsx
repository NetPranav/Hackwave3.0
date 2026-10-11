"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Card, CardHeader } from "@/components/dashboard/Card";
import type { FixRuleData } from "@/lib/mock/fixes";

const PANEL = "rounded border border-box-outline/70 bg-inset p-4 dark:border-dark-border dark:bg-dark-inset";
const PANEL_HEAD =
  "mb-2 flex items-center justify-between border-b border-box-outline/40 pb-2 font-aeonik-mono text-[10px] uppercase tracking-wider dark:border-dark-border/40";

/** Red → green: run applyAliases on the drifted response and watch the shop test flip. Remount per rule (key). */
export default function AliasProof({ fix }: { fix: FixRuleData }) {
  const [fixed, setFixed] = useState(fix.status === "merged");
  const blocked = fix.status === "safety_blocked";

  return (
    <Card>
      <CardHeader
        title="Proof · the shop's test"
        aside={
          !blocked && (
            <button
              type="button"
              onClick={() => setFixed((v) => !v)}
              className="rounded border border-btn-primary bg-btn-primary px-3 py-1 font-aeonik-mono text-xs uppercase tracking-wider text-white transition-colors hover:border-accent hover:bg-accent dark:border-dark-btn-primary dark:bg-dark-btn-primary"
            >
              {fixed ? "Undo" : "Apply the fix"}
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
        <div className={PANEL}>
          <div className={PANEL_HEAD}>
            <span className="text-text-primary/50 dark:text-white/45">What the API sends now</span>
            <span className="text-bad dark:text-bad-bright">missing &apos;{fix.targetField}&apos;</span>
          </div>
          <pre className="overflow-x-auto font-aeonik-mono text-[11px] leading-relaxed text-text-primary/80 dark:text-white/80">
            {JSON.stringify(fix.syntheticV2Payload, null, 2)}
          </pre>
        </div>

        <div className={PANEL}>
          <div className={PANEL_HEAD}>
            <span className="text-text-primary/50 dark:text-white/45">What the app receives</span>
            <span className={fixed ? "text-ok dark:text-ok-bright" : "text-text-primary/50 dark:text-white/45"}>
              {fixed ? "with the fix" : "without the fix"}
            </span>
          </div>
          <motion.pre
            key={fixed ? "fixed" : "raw"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "overflow-x-auto font-aeonik-mono text-[11px] leading-relaxed",
              fixed ? "text-ok dark:text-ok-bright" : "text-text-primary/80 dark:text-white/80"
            )}
          >
            {JSON.stringify(fixed ? fix.syntheticRuntimeOutput : fix.syntheticV2Payload, null, 2)}
          </motion.pre>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-box-outline px-5 py-3 font-aeonik-mono text-xs dark:border-dark-border">
        <span className="text-text-primary/40 dark:text-white/40">SHOP TEST</span>
        <span
          aria-hidden
          className={cn("h-2 w-2 rounded-full", fixed ? "bg-ok dark:bg-ok-bright" : "bg-bad dark:bg-bad-bright")}
        />
        <motion.span
          key={fixed ? "after" : "before"}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className={cn("font-medium", fixed ? "text-ok dark:text-ok-bright" : "text-bad dark:text-bad-bright")}
        >
          {fixed ? fix.testAssertion.afterFix : fix.testAssertion.beforeFix}
        </motion.span>
      </div>
    </Card>
  );
}
