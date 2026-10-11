"use client";

import { cn } from "@/lib/utils";
import Counter from "@/components/ui/Counter";
import { Card } from "@/components/dashboard/Card";
import { overviewStats } from "@/lib/mock/overview";
import { useSeismoData } from "@/lib/api/data";
import type { TableFilter } from "./ServicesTable";

interface KpiCellProps {
  label: string;
  title: string;
  detail: string;
  value: number;
  places: (number | ".")[];
  suffix?: React.ReactNode;
  accent?: boolean;
  onClick: () => void;
}

const SUFFIX = "ml-2 font-aeonik-mono text-xs leading-normal whitespace-nowrap";

/** One big animated number with its label and a one-line detail. Clicking filters the table below. */
function KpiCell({ label, title, detail, value, places, suffix, accent, onClick }: KpiCellProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="group p-5 text-left transition-colors hover:bg-dash-bg/40 dark:hover:bg-white/[0.02] md:p-6"
    >
      <span
        className={cn(
          "font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50 transition-colors dark:text-white/45",
          accent ? "group-hover:text-accent" : "group-hover:text-text-primary dark:group-hover:text-white"
        )}
      >
        {label}
      </span>
      <div className="mt-3 flex items-baseline">
        <Counter
          value={value}
          places={places}
          fontSize={44}
          padding={4}
          gap={1}
          horizontalPadding={0}
          gradientHeight={0}
          textColor={accent ? "var(--color-accent)" : "inherit"}
          fontWeight={500}
          className={cn("font-aeonik text-4xl font-medium tracking-tight lg:text-5xl", accent && "text-accent")}
          suffix={suffix}
        />
      </div>
      <div className="mt-2 text-xs text-text-primary/60 dark:text-white/60">{detail}</div>
    </button>
  );
}

const Muted = ({ children }: { children: React.ReactNode }) => (
  <span className={cn(SUFFIX, "text-text-primary/40 dark:text-white/40")}>{children}</span>
);

/** Four numbers that answer "is everything fine?": APIs, coverage, changes, fixes. */
export default function KpiStrip({ onFilter }: { onFilter: (filter: TableFilter) => void }) {
  const S = overviewStats(useSeismoData());
  const prLabel = S.openPrNumbers.map((n) => "PR #" + n).join(" · ");

  return (
    <Card>
      <div className="grid grid-cols-1 divide-y divide-box-outline dark:divide-dark-border sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
        <KpiCell
          label="ACTIVE APIS"
          title="Show all monitored services"
          detail={S.endpoints + " API calls working"}
          value={S.apis}
          places={S.apis >= 10 ? [10, 1] : [1]}
          suffix={<Muted>/ {S.apis} LIVE</Muted>}
          onClick={() => onFilter("all")}
        />
        <KpiCell
          label="CODE COVERAGE"
          title="Show all monitored services"
          detail={S.callSites + " places in your code found"}
          value={S.fieldCoverage}
          places={S.fieldCoverage >= 100 ? [100, 10, 1, ".", 0.1] : [10, 1, ".", 0.1]}
          suffix="%"
          onClick={() => onFilter("all")}
        />
        <KpiCell
          label="ACTIVE CHANGES"
          title="Show services with a detected change"
          detail={S.breaking + " breaking · " + S.suspected + " suspected"}
          value={S.changes}
          places={[1]}
          accent
          suffix={<span className={cn(SUFFIX, "text-accent")}>DETECTED</span>}
          onClick={() => onFilter("drifts")}
        />
        <KpiCell
          label="FIXES READY"
          title="Show services with an open fix PR"
          detail={(prLabel || "None open") + " · all safety checks passed"}
          value={S.openPrNumbers.length}
          places={[1]}
          suffix={<Muted>OPEN</Muted>}
          onClick={() => onFilter("fixes")}
        />
      </div>
    </Card>
  );
}
