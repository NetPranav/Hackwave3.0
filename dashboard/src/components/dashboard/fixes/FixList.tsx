"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/dashboard/Card";
import type { FixRuleData } from "@/lib/mock/fixes";
import FixStatusLabel from "./FixStatusLabel";

interface FixListProps {
  fixes: FixRuleData[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

/** Quiet queue: one row per rule, a status word on the right, a thin accent edge on the selected row. */
export default function FixList({ fixes, selectedId, onSelect }: FixListProps) {
  return (
    <Card>
      {fixes.length === 0 ? (
        <p className="px-5 py-8 text-center font-aeonik-light text-sm text-text-primary/60 dark:text-white/60">
          No rules in this stage.
        </p>
      ) : (
        <ul className="divide-y divide-box-outline/50 dark:divide-dark-border/50">
          {fixes.map((fix) => {
            const isSelected = fix.id === selectedId;
            const isReview = fix.status === "safety_blocked";
            return (
              <li key={fix.id}>
                <button
                  type="button"
                  onClick={() => onSelect(fix.id)}
                  aria-current={isSelected}
                  className={cn(
                    "block w-full border-l-2 px-5 py-4 text-left transition-colors",
                    isSelected
                      ? "border-l-accent bg-dash-bg/70 dark:bg-white/[0.04]"
                      : "border-l-transparent hover:bg-dash-bg/40 dark:hover:bg-white/[0.02]"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-aeonik text-sm font-medium text-text-primary dark:text-white">
                      {fix.service}
                    </span>
                    <FixStatusLabel fix={fix} />
                  </div>

                  <div className="mt-2 flex items-center gap-2 font-aeonik-mono text-xs text-text-primary/60 dark:text-white/60">
                    <span className="text-[10px] font-semibold text-ok dark:text-ok-bright">{fix.method}</span>
                    <span className="truncate">{fix.endpoint}</span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-3 font-aeonik-mono text-[11px]">
                    <span className="inline-flex items-center gap-1.5 rounded border border-box-outline/60 bg-inset px-2 py-0.5 dark:border-dark-border dark:bg-dark-inset">
                      <span className={cn(isReview ? "text-text-primary dark:text-white" : "text-bad dark:text-bad-bright")}>
                        {fix.sourceField}
                      </span>
                      <span className="text-text-primary/40 dark:text-white/40">→</span>
                      <span
                        className={cn(
                          "font-medium",
                          isReview ? "text-warn dark:text-warn-bright" : "text-ok dark:text-ok-bright"
                        )}
                      >
                        {fix.targetField}
                      </span>
                    </span>
                    <span className="text-[10px] text-text-primary/40 dark:text-white/40">
                      {fix.detectedAt.split(" ")[0]}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
