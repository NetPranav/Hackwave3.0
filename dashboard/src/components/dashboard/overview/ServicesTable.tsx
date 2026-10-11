"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import RubberSegment, { type RubberSegmentItem } from "@/components/ui/RubberSegment";
import { Card } from "@/components/dashboard/Card";
import { useCopy } from "@/hooks/useCopy";
import StateLabel from "@/components/dashboard/status/StateLabel";
import { overviewRows, type OverviewRow } from "@/lib/mock/overview";
import { useSeismoData } from "@/lib/api/data";

export type TableFilter = "all" | "drifts" | "fixes" | "review" | "healthy";

const FILTER_ITEMS: RubberSegmentItem[] = [
  { value: "all", label: "ALL" },
  { value: "drifts", label: "CHANGED" },
  { value: "fixes", label: "FIXES" },
  { value: "review", label: "REVIEW" },
  { value: "healthy", label: "STABLE" },
];

const TH = "px-3 py-2.5 first:pl-4 last:pr-4";
const TD = "px-3 py-3 first:pl-4 last:pr-4";
const BUTTON =
  "inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-aeonik-mono text-xs uppercase tracking-wider transition-colors";

function matches(row: OverviewRow, filter: TableFilter): boolean {
  switch (filter) {
    case "drifts":
      return row.state !== "normal";
    case "fixes":
      return row.action.type === "pr";
    case "review":
      return row.action.type === "review";
    case "healthy":
      return row.state === "normal";
    default:
      return true;
  }
}

function RowAction({ row }: { row: OverviewRow }) {
  const a = row.action;
  if (a.type === "pr") {
    return (
      <a
        href={"https://github.com/NetPranav/seismo-demo-shop/pull/" + a.number}
        target="_blank"
        rel="noreferrer"
        className={cn(
          BUTTON,
          "border-btn-primary bg-btn-primary text-white hover:border-accent hover:bg-accent dark:border-dark-btn-primary dark:bg-dark-btn-primary"
        )}
      >
        PR #{a.number} ↗
      </a>
    );
  }
  const quiet =
    "border-box-outline text-text-primary/70 hover:border-text-primary hover:text-text-primary dark:border-dark-border dark:text-white/70 dark:hover:text-white";
  return a.type === "review" ? (
    <Link href="/app/review" className={cn(BUTTON, quiet)}>
      Review ↗
    </Link>
  ) : (
    <Link href={"/app/status/" + row.slug} className={cn(BUTTON, quiet)}>
      Status
    </Link>
  );
}

function ServiceCell({ row }: { row: OverviewRow }) {
  const { copied, copy } = useCopy();
  return (
    <td className={TD}>
      <div className="flex items-center gap-2">
        <Link
          href={"/app/status/" + row.slug}
          className="font-aeonik font-medium text-text-primary underline-offset-4 hover:underline dark:text-white"
        >
          {row.name}
        </Link>
        <span className="font-aeonik-mono text-[10px] text-text-primary/40 dark:text-white/40">{row.lastSeen}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 font-aeonik-mono text-xs text-text-primary/70 dark:text-white/70">
        <span className="text-[10px] font-semibold text-ok dark:text-ok-bright">{row.method}</span>
        <span className="max-w-[240px] truncate text-text-primary/80 dark:text-white/80">{row.endpoint}</span>
        <button
          type="button"
          onClick={() => copy(row.traceId, row.id)}
          title={"Copy trace ID: " + row.traceId}
          className="text-[10px] text-text-primary/40 transition-colors hover:text-text-primary dark:text-white/35 dark:hover:text-white"
        >
          {copied === row.id ? "✓" : row.traceId.slice(0, 8) + "…"}
        </button>
      </div>
    </td>
  );
}

function DiffCell({ diff }: { diff: OverviewRow["diff"] }) {
  return (
    <td className={cn(TD, "font-aeonik-mono text-xs")}>
      {diff && diff.before ? (
        <div className="inline-flex items-center gap-1.5 rounded border border-box-outline/60 bg-inset px-2 py-1 dark:border-dark-border dark:bg-dark-inset">
          <span className="text-bad dark:text-bad-bright">{diff.before}</span>
          <span className="font-bold text-text-primary/40 dark:text-white/45">→</span>
          <span className="font-medium text-ok dark:text-ok-bright">{diff.after}</span>
        </div>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-text-primary/40 dark:text-white/40">
          <span className="h-1 w-1 rounded-full bg-ok/60 dark:bg-ok-bright/60" />
          No change detected
        </span>
      )}
    </td>
  );
}

/** Every monitored API, worst first: what changed, which workflow it touches, and the next click. */
export default function ServicesTable({ filter, onFilterChange }: { filter: TableFilter; onFilterChange: (f: TableFilter) => void }) {
  const OVERVIEW_ROWS = overviewRows(useSeismoData());
  const rows = OVERVIEW_ROWS.filter((r) => matches(r, filter));

  return (
    <Card id="services" className="scroll-mt-14">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-box-outline p-2.5 dark:border-dark-border">
        <RubberSegment
          items={FILTER_ITEMS}
          value={filter}
          onChange={(v) => onFilterChange(v as TableFilter)}
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
          aria-label="Filter services"
        />
        <span className="hidden pr-2 font-aeonik-mono text-[11px] text-text-primary/50 dark:text-white/45 sm:block">
          {rows.length} OF {OVERVIEW_ROWS.length} SERVICES
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-box-outline bg-dash-bg/60 font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/60 dark:border-dark-border dark:bg-dark-dash-bg/60 dark:text-white/60">
              <th className={TH}>API & CALL</th>
              <th className={TH}>CHANGE</th>
              <th className={TH}>AFFECTS</th>
              <th className={TH}>STATUS</th>
              <th className={cn(TH, "text-right")}>ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-box-outline/40 font-aeonik-light text-sm dark:divide-dark-border/40">
            {rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-dash-bg/40 dark:hover:bg-white/[0.03]">
                <ServiceCell row={row} />
                <DiffCell diff={row.diff} />
                <td className={TD}>
                  <span className="rounded bg-dash-bg/80 px-2 py-0.5 font-aeonik-mono text-[11px] text-text-primary/70 dark:bg-white/[0.04] dark:text-white/70">
                    {row.workflow}
                  </span>
                </td>
                <td className={TD}>
                  <StateLabel state={row.state} className="text-xs" />
                </td>
                <td className={cn(TD, "text-right")}>
                  <RowAction row={row} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center font-aeonik-light text-sm text-text-primary/60 dark:text-white/60">
                  No services in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
