"use client";

import { cn } from "@/lib/utils";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";

export type PipelineTone = "default" | "accent" | "ok" | "warn";

export interface PipelineStep {
  value: string;
  label: string;
  count: number;
  caption: string;
  tone?: PipelineTone;
  /** Side branch (e.g. "sent to review"): joined by a dashed connector. */
  branch?: boolean;
}

interface PipelineStepperProps {
  steps: PipelineStep[];
  activeValue: string;
  onSelect: (value: string) => void;
  className?: string;
}

const DOT_TONE: Record<PipelineTone, string> = {
  default: "bg-text-primary dark:bg-white",
  accent: "bg-accent",
  ok: "bg-ok dark:bg-ok-bright",
  warn: "bg-warn dark:bg-warn-bright",
};

const COUNT_TONE: Record<PipelineTone, string> = {
  default: "text-text-primary dark:text-white",
  accent: "text-accent",
  ok: "text-ok dark:text-ok-bright",
  warn: "text-warn dark:text-warn-bright",
};

/** Horizontal stage tracker: one card, a hairline rail, a node and a count per stage. */
export default function PipelineStepper({ steps, activeValue, onSelect, className }: PipelineStepperProps) {
  return (
    <section
      aria-label="Fix pipeline"
      className={cn(
        "overflow-hidden rounded-md border border-box-outline bg-section transition-colors dark:border-dark-border dark:bg-dark-dash-section",
        className
      )}
    >
      <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-flow-col lg:auto-cols-fr">
        {steps.map((step, i) => {
          const tone = step.tone ?? "default";
          const isActive = step.value === activeValue;
          const filled = step.count > 0;
          const isFirst = i === 0;

          return (
            <li key={step.value} className="relative">
              {/* Rail (large screens): spans the whole cell so neighbours join; first starts at its dot */}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute right-0 top-[22px] hidden h-px lg:block",
                  isFirst ? "left-[34px]" : "left-0",
                  step.branch
                    ? "border-t border-dashed border-box-outline dark:border-dark-border"
                    : "bg-box-outline dark:bg-dark-border"
                )}
              />
              <button
                type="button"
                onClick={() => onSelect(step.value)}
                aria-pressed={isActive}
                className={cn(
                  "group block h-full w-full cursor-pointer px-5 pb-5 pt-4 text-left transition-colors md:px-6",
                  "hover:bg-dash-bg/40 dark:hover:bg-white/[0.02]",
                  isActive && "bg-dash-bg/60 dark:bg-white/[0.04]"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "relative z-10 mb-5 block h-3 w-3 rounded-full border-2 border-section transition-all dark:border-dark-dash-section",
                    filled ? DOT_TONE[tone] : "bg-box-outline dark:bg-dark-border",
                    isActive && "ring-2 ring-text-primary/25 dark:ring-white/30"
                  )}
                />

                <span className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50 transition-colors group-hover:text-text-primary dark:text-white/45 dark:group-hover:text-white">
                  {step.label}
                </span>
                <div className="mt-2">
                  <AnimatedNumber
                    value={step.count}
                    size={44}
                    weight={500}
                    className={cn(
                      "font-aeonik tracking-tight",
                      filled ? COUNT_TONE[tone] : "text-text-primary/30 dark:text-white/30"
                    )}
                  />
                </div>
                <div className="mt-2 text-xs text-text-primary/60 dark:text-white/60">{step.caption}</div>
              </button>
              {!isFirst && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 hidden w-px bg-box-outline/60 dark:bg-dark-border/60 lg:block"
                />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
