"use client";

import RubberSegment, { type RubberSegmentItem } from "@/components/ui/RubberSegment";

export type SeverityFilter = "all" | "breaking" | "suspected" | "fix";

const SEVERITY_ITEMS: RubberSegmentItem[] = [
  { value: "all", label: "ALL" },
  { value: "breaking", label: "BREAKING" },
  { value: "suspected", label: "SUSPECTED" },
  { value: "fix", label: "FIX READY" },
];

const FLOAT =
  "rounded-md border border-box-outline/50 bg-section/80 dark:border-dark-border/60 dark:bg-dark-dash-section/80";

interface GraphToolbarProps {
  severity: SeverityFilter;
  onSeverityChange: (s: SeverityFilter) => void;
}

/** Left side of the top bar: filter by severity. */
export default function GraphToolbar(p: GraphToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className={FLOAT + " p-1"}>
        <RubberSegment
          items={SEVERITY_ITEMS}
          value={p.severity}
          onChange={(v) => p.onSeverityChange(v as SeverityFilter)}
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
          aria-label="Filter by severity"
        />
      </div>
    </div>
  );
}

