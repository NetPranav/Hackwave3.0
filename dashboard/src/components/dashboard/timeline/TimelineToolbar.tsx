"use client";

import RubberSegment, { type RubberSegmentItem } from "@/components/ui/RubberSegment";
import { Card } from "@/components/dashboard/Card";

export const SEVERITY_FILTERS: RubberSegmentItem[] = [
  { value: "all", label: "ALL EVENTS" },
  { value: "breaking", label: "BREAKING" },
  { value: "suspected", label: "SUSPECTED" },
  { value: "info", label: "INFO & DEPLOYS" },
];

const FIELD =
  "rounded border border-box-outline bg-dash-bg px-2.5 py-1 font-aeonik-mono text-xs text-text-primary placeholder:text-text-primary/40 focus:border-text-primary focus:outline-none dark:border-dark-border dark:bg-dark-dash-bg dark:text-white dark:placeholder:text-white/30 dark:focus:border-white";

interface TimelineToolbarProps {
  severity: string;
  onSeverityChange: (value: string) => void;
  service: string;
  onServiceChange: (value: string) => void;
  services: { slug: string; name: string }[];
  query: string;
  onQueryChange: (value: string) => void;
}

/** Severity chips on the left; provider and search on the right. */
export default function TimelineToolbar(props: TimelineToolbarProps) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-2.5">
      <RubberSegment
        items={SEVERITY_FILTERS}
        value={props.severity}
        onChange={props.onSeverityChange}
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
        aria-label="Filter events by severity"
      />

      <div className="flex items-center gap-2 pr-1">
        <select
          value={props.service}
          onChange={(e) => props.onServiceChange(e.target.value)}
          aria-label="Filter by provider"
          className={`${FIELD} cursor-pointer uppercase`}
        >
          <option value="all">All providers</option>
          {props.services.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Search events..."
          value={props.query}
          onChange={(e) => props.onQueryChange(e.target.value)}
          aria-label="Search events"
          className={FIELD}
        />
      </div>
    </Card>
  );
}
