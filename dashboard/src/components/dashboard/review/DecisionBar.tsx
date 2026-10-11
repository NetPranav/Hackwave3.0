"use client";

import { cn } from "@/lib/utils";
import Counter from "@/components/ui/Counter";
import { Card } from "@/components/dashboard/Card";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import { REVIEW_REASONS, type ReviewItem, type ReviewReason } from "@/lib/mock/review";

interface DecisionBarProps {
  open: ReviewItem[];
  aiOn: boolean;
  onToggleAi: () => void;
}

function AiSwitch({ aiOn, onToggle }: { aiOn: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={aiOn} onClick={onToggle} className="flex items-center gap-3 text-left">
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
          aiOn
            ? "border-btn-primary bg-btn-primary dark:border-dark-btn-primary dark:bg-dark-btn-primary"
            : "border-box-outline bg-dash-bg dark:border-dark-border dark:bg-white/[0.04]"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all",
            aiOn ? "left-[18px] bg-white" : "left-0.5 bg-text-primary/40 dark:bg-white/40"
          )}
        />
      </span>
      <span>
        <span className="block font-aeonik-mono text-[10px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45">
          AI explanations
        </span>
        <span className="block font-aeonik-mono text-xs text-text-primary dark:text-white">
          {aiOn ? "On" : "Off: standard text"}
        </span>
      </span>
    </button>
  );
}

/** One block: the headline count on the left, a bordered strip of reasons and the AI switch on the right. */
export default function DecisionBar({ open, aiOn, onToggleAi }: DecisionBarProps) {
  const countFor = (reason: ReviewReason) => open.filter((i) => i.reason === reason).length;

  return (
    <Card>
      <div className="flex flex-wrap items-stretch justify-between">
        <div className="p-5 md:p-6">
          <span className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45">
            Waiting for you
          </span>
          <div className="mt-3 flex items-baseline gap-3">
            <Counter
              value={open.length}
              fontSize={44}
              places={[1]}
              padding={4}
              gap={1}
              horizontalPadding={0}
              gradientHeight={0}
              textColor={open.length > 0 ? "var(--color-accent)" : "inherit"}
              fontWeight={500}
              className="font-aeonik text-4xl font-medium tracking-tight lg:text-5xl"
            />
            <span className="font-aeonik-light text-sm text-text-primary/70 dark:text-white/70">
              {open.length === 1 ? "change needs" : "changes need"} a human decision
            </span>
          </div>
          <p className="mt-2 text-xs text-text-primary/60 dark:text-white/60">
            Seismo never auto-fixes these. It explains, suggests, and waits.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-stretch divide-x divide-box-outline border-t border-box-outline dark:divide-dark-border dark:border-dark-border lg:w-auto lg:border-l lg:border-t-0">
          {(Object.keys(REVIEW_REASONS) as ReviewReason[]).map((reason) => (
            <div key={reason} className="flex flex-col justify-center px-6 py-5">
              <span className="font-aeonik-mono text-[10px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45">
                {REVIEW_REASONS[reason].label}
              </span>
              <AnimatedNumber
                value={countFor(reason)}
                size={28}
                weight={500}
                className="mt-1.5 font-aeonik text-text-primary dark:text-white"
              />
            </div>
          ))}
          <div className="flex items-center px-6 py-5">
            <AiSwitch aiOn={aiOn} onToggle={onToggleAi} />
          </div>
        </div>
      </div>
    </Card>
  );
}
