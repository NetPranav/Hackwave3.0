"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import GlideSelect, { type GlideSelectOption } from "@/components/ui/GlideSelect";
import { Card } from "@/components/dashboard/Card";
import { BUCKET_LABELS, overviewStats, type ChartMetric } from "@/lib/mock/overview";
import { useSeismoData } from "@/lib/api/data";

const BAR_COLOR: Record<ChartMetric, string> = {
  volume: "bg-text-primary/75 hover:bg-text-primary dark:bg-white/80 dark:hover:bg-white",
  latency: "bg-warn-bright hover:bg-warn-bright/80",
  drifts: "bg-accent hover:bg-accent/80",
};

const metricOptions = (changes: number): GlideSelectOption[] => [
  { value: "volume", label: "TRAFFIC", tag: "requests/min" },
  { value: "latency", label: "RESPONSE TIME", tag: "ms" },
  { value: "drifts", label: "DETECTED CHANGES", tag: changes + " active" },
];

const BARS_PER_DAY = BUCKET_LABELS.length;

function describe(metric: ChartMetric, value: number, note?: string | null): string {
  if (metric === "volume") return value.toLocaleString("en-US") + " calls/min";
  if (metric === "latency") return value + "ms";
  return value + (value === 1 ? " change" : " changes") + (note ? " (" + note + ")" : "");
}

interface Hover {
  key: string;
  text: string;
  when: string;
}

/** Seven days, four bars a day. Switch the metric in the corner; hover a bar for its value. Today stops at "now". */
export default function MetricChart() {
  const data = useSeismoData();
  // LIVE (default when the engine is connected): last 32 minutes per minute, refreshed every 5 s. 7 DAYS: per 6 hours.
  const [range, setRange] = useState<"live" | "7d">("live");
  const shown = range === "live" && data.liveChart ? data.liveChart : data.chart;
  const isLive = range === "live" && !!data.liveChart;
  const { days: CHART_DAYS, max: CHART_MAX, ticks: CHART_TICKS } = shown;
  const TOTAL_BARS = CHART_DAYS.length * BARS_PER_DAY;
  const METRIC_OPTIONS = metricOptions(overviewStats(data).changes);
  const { isDark } = useTheme();
  const reduce = useReducedMotion() ?? false;
  const [metric, setMetric] = useState<ChartMetric>("volume");
  const [hover, setHover] = useState<Hover | null>(null);

  return (
    <Card id="volume" className="scroll-mt-14 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GlideSelect
          options={METRIC_OPTIONS}
          value={metric}
          onChange={(v) => {
            setMetric(v as ChartMetric);
            setHover(null);
          }}
          ariaLabel="Metric view"
          showTags
          accentColor="var(--color-accent)"
          surfaceColor={isDark ? "var(--color-dark-dash-section)" : "var(--color-section)"}
          highlightColor={isDark ? "var(--rs-thumb-theme)" : "var(--rs-track-theme)"}
          textColor={isDark ? "var(--color-white)" : "var(--color-text-primary)"}
          size="sm"
          radius={6}
          menuWidth={210}
          placement="bottom"
          align="left"
          popDuration={180}
          glideDuration={220}
          rememberPosition
        />
        <div className="flex items-center gap-1 font-aeonik-mono text-[10px]">
          {data.liveChart && (
            <button
              type="button"
              onClick={() => setRange("live")}
              className={cn("rounded border px-2 py-0.5", isLive ? "border-accent text-accent" : "border-box-outline/60 text-text-primary/50 dark:border-dark-border dark:text-white/40")}
            >
              {isLive && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent align-middle" />}LIVE · 32 MIN
            </button>
          )}
          <button
            type="button"
            onClick={() => setRange("7d")}
            className={cn("rounded border px-2 py-0.5", !isLive ? "border-text-primary/40 text-text-primary dark:border-white/40 dark:text-white" : "border-box-outline/60 text-text-primary/50 dark:border-dark-border dark:text-white/40")}
          >
            LAST 7 DAYS
          </button>
        </div>
      </div>

      <div className="relative mt-6 flex h-48 w-full gap-3">
        <div className="flex h-full select-none flex-col justify-between pb-0.5 pr-1 font-aeonik-mono text-[10px] text-text-primary/40 dark:text-white/40">
          {CHART_TICKS[metric].map((tick) => (
            <span key={tick} className="text-right leading-none">
              {tick}
            </span>
          ))}
        </div>

        <div className="relative h-full flex-1">
          <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-px w-full bg-box-outline/35 dark:bg-dark-border/40" />
            ))}
            <div className="h-px w-full bg-box-outline/60 dark:bg-dark-border" />
          </div>

          <div className="relative z-10 flex h-full items-end justify-between px-2">
            {CHART_DAYS.map((day, d) => (
              <div key={day.date} className="flex h-full flex-1 items-end justify-between px-1.5 sm:px-2.5 md:px-3">
                {BUCKET_LABELS.map((slotLabel, b) => {
                  const time = day.labels?.[b] ?? slotLabel;
                  const value = day[metric][b];
                  const slot = "w-2 sm:w-3 md:w-3.5";
                  if (value === null) return <div key={time} aria-hidden className={slot} />;

                  const i = d * BARS_PER_DAY + b;
                  const key = range + "-" + metric + "-" + i;
                  const height = Math.min(Math.max((value / CHART_MAX[metric]) * 100, 4), 100);
                  const hovered = hover?.key === key;
                  const edge = i < 3 ? "left-0" : i >= TOTAL_BARS - 6 ? "right-0" : "left-1/2 -translate-x-1/2";
                  const text = describe(metric, value, metric === "drifts" ? day.driftNotes?.[b] : null);

                  return (
                    <div
                      key={key}
                      className="relative flex h-full flex-col items-center justify-end"
                      onMouseEnter={() => setHover({ key, text, when: day.date + " " + time })}
                      onMouseLeave={() => setHover(null)}
                    >
                      {hovered && (
                        <motion.div
                          initial={{ opacity: 0, y: 3, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.12, ease: "easeOut" }}
                          style={{ bottom: "calc(" + Math.min(Math.max(height, 6), 88) + "% + 8px)" }}
                          className={cn(
                            "pointer-events-none absolute z-30 whitespace-nowrap rounded border border-box-outline bg-section px-2.5 py-1 font-aeonik-mono text-[11px] shadow-lg dark:border-dark-border dark:bg-dark-dash-section",
                            edge
                          )}
                        >
                          <span className="text-text-primary/60 dark:text-white/60">{hover.when}: </span>
                          <span className="font-medium text-text-primary dark:text-white">{hover.text}</span>
                        </motion.div>
                      )}
                      <motion.div
                        initial={reduce ? false : { height: "0%" }}
                        animate={{ height: height + "%" }}
                        transition={{ duration: isLive ? 0.35 : 0.5, delay: isLive ? 0 : i * 0.015, ease: [0.16, 1, 0.3, 1] }}
                        style={{ minHeight: "4px" }}
                        className={cn(
                          "w-2 cursor-pointer rounded-t-[2px] transition-colors sm:w-3 md:w-3.5",
                          BAR_COLOR[metric],
                          hovered && "ring-1 ring-text-primary/40 dark:ring-white/50"
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-between pl-9 pr-2 font-aeonik-mono text-[10px] tracking-wider text-text-primary/50 dark:text-white/50">
        {CHART_DAYS.map((day, d) => (
          <div key={day.date} className={cn("flex-1 px-2 text-left sm:px-3", d === CHART_DAYS.length - 1 && "text-text-primary dark:text-white")}>
            {day.date}
            {d === CHART_DAYS.length - 1 && <span className="ml-1 text-accent">NOW</span>}
          </div>
        ))}
      </div>
    </Card>
  );
}
