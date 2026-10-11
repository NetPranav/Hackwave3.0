"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/dashboard/Card";
import { daysUntil } from "@/lib/mock/radar";
import { useSeismoData } from "@/lib/api/data";
import RadarRunway from "./RadarRunway";
import RadarRow from "./RadarRow";
import { DOT, FILTERS, isLive, matchesFilter, type RadarFilter } from "./radarMeta";

const LEGEND = [
  { label: "Breaking", dot: DOT.breaking },
  { label: "Suspected", dot: DOT.warning },
  { label: "Good to know", dot: DOT.info },
];

const TODAY_DIVIDER =
  "flex items-center gap-3 bg-dash-bg/50 px-5 py-1.5 font-aeonik-mono text-[10px] uppercase tracking-[0.2em] text-text-primary/45 dark:bg-white/[0.02] dark:text-white/40 md:px-8";

/** Radar: one line from today forward, then one row per change the providers have announced. */
export default function RadarView() {
  const RADAR_ITEMS = useSeismoData().radar;
  const [filter, setFilter] = useState<RadarFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const items = useMemo(
    () => RADAR_ITEMS.filter((i) => matchesFilter(i, filter)).sort((a, b) => (daysUntil(a) ?? Infinity) - (daysUntil(b) ?? Infinity)),
    [filter, RADAR_ITEMS]
  );
  const upcoming = RADAR_ITEMS.filter((i) => !isLive(i));
  const soon = upcoming.filter((i) => (daysUntil(i) ?? Infinity) <= 30);
  const firstUpcoming = items.findIndex((i) => !isLive(i));

  const select = (id: string) => {
    setOpenId(id);
    setFilter("all");
    requestAnimationFrame(() => document.getElementById("radar-" + id)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-8 md:px-10">
      <header className="mb-6">
        <h1 className="font-aeonik text-3xl font-medium tracking-tight text-text-primary dark:text-white md:text-4xl">
          {upcoming.length} changes are coming.
        </h1>
        <p className="mt-2 font-aeonik-light text-sm text-text-primary/60 dark:text-white/60 md:text-base">
          {soon.length === 0 ? "None are due in the next 30 days." : soon.length + (soon.length === 1 ? " is" : " are") + " due in the next 30 days."} The
          providers announced them, but they are not live yet.
        </p>
      </header>

      <Card>
        <RadarRunway items={RADAR_ITEMS} selectedId={openId} onSelect={select} />

        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-box-outline px-5 py-3 dark:border-dark-border md:px-8">
          <div className="flex items-center gap-1" role="group" aria-label="Filter changes">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                aria-pressed={filter === f.value}
                className={cn(
                  "rounded px-2.5 py-1 font-aeonik-mono text-xs uppercase tracking-wider transition-colors",
                  filter === f.value
                    ? "bg-btn-primary text-white dark:bg-dark-btn-primary"
                    : "text-text-primary/60 hover:text-text-primary dark:text-white/60 dark:hover:text-white"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4">
            {LEGEND.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/50 dark:text-white/45">
                <span aria-hidden className={cn("h-2 w-2 rounded-full", l.dot)} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <p className="px-5 py-12 text-center font-aeonik-light text-sm text-text-primary/60 dark:text-white/60">Nothing here. All clear.</p>
        ) : (
          <ul className="divide-y divide-box-outline/60 dark:divide-dark-border/60">
            {items.map((item, index) => (
              <div key={item.id} className="contents">
                {index === firstUpcoming && index > 0 && (
                  <li aria-hidden className={TODAY_DIVIDER}>
                    Today
                    <span className="h-px flex-1 bg-box-outline dark:bg-dark-border" />
                  </li>
                )}
                <RadarRow item={item} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} />
              </div>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
