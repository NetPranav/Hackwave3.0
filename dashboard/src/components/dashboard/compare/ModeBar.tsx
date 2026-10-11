"use client";

import RubberSegment, { type RubberSegmentItem } from "@/components/ui/RubberSegment";
import { Card } from "@/components/dashboard/Card";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import EndpointSelect from "./EndpointSelect";

export type Mode = "compare" | "simulate";

const MODES: RubberSegmentItem[] = [
  { value: "compare", label: "COMPARE" },
  { value: "simulate", label: "SIMULATE A CHANGE" },
];

interface ModeBarProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  endpointId: string;
  onEndpointChange: (id: string) => void;
  stat: { value: number; label: string };
}

const BLURB: Record<Mode, string> = {
  compare: "See how an API call used to look next to how it looks now.",
  simulate: "Pick a change and see what it would affect and what Seismo would suggest. Nothing is actually changed.",
};

/** The page opener: choose Compare or Simulate and the endpoint, with the one number that matters for the mode. */
export default function ModeBar({ mode, onModeChange, endpointId, onEndpointChange, stat }: ModeBarProps) {
  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-6 p-5 md:p-6">
        <div>
          <span className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45">
            Compare & simulate
          </span>
          <div className="mt-3 flex items-baseline gap-3">
            <AnimatedNumber value={stat.value} size={44} weight={500} className="font-aeonik tracking-tight" />
            <span className="font-aeonik-light text-sm text-text-primary/70 dark:text-white/70">{stat.label}</span>
          </div>
          <p className="mt-2 text-xs text-text-primary/60 dark:text-white/60">{BLURB[mode]}</p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[320px]">
          <RubberSegment
            items={MODES}
            value={mode}
            onChange={(v) => onModeChange(v as Mode)}
            size="sm"
            radius={6}
            inset={2}
            equalSlots={false}
            stretch={50}
            squash={2}
            speed={1}
            trackColor="var(--rs-track-theme)"
            thumbColor="var(--rs-thumb-theme)"
            textColor="var(--rs-ink-theme)"
            activeTextColor="var(--rs-ink-active-theme)"
            className="font-aeonik-mono text-[11px] uppercase tracking-wider"
            aria-label="Mode"
          />
          <EndpointSelect value={endpointId} onChange={onEndpointChange} />
        </div>
      </div>
    </Card>
  );
}
