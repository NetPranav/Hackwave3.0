"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/dashboard/Card";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import { useSeismoData, type SeismoData } from "@/lib/api/data";
import {
  type EventSeverity,
  type TimelineDriftEvent,
  type TimelineItem,
} from "@/lib/mock/timeline";

interface Bucket {
  index: number;
  events: { title: string; severity: EventSeverity }[];
  deploys: string[];
  worst: EventSeverity | null;
}

const RANK: Record<EventSeverity, number> = { breaking: 0, suspected: 1, info: 2, resolved: 3 };

/** Height says how serious the worst event in the window is. */
const HEIGHT: Record<EventSeverity, number> = { breaking: 88, suspected: 62, info: 38, resolved: 38 };

/** Bar fill per severity. Orange only for breaking, so it stands out. */
const BAR_TONE: Record<EventSeverity, string> = {
  breaking: "bg-accent",
  suspected: "bg-warn dark:bg-warn-bright",
  info: "bg-text-primary/35 dark:bg-white/35",
  resolved: "bg-text-primary/35 dark:bg-white/35",
};

const DOT_TONE: Record<EventSeverity, string> = {
  breaking: "bg-accent",
  suspected: "bg-warn dark:bg-warn-bright",
  info: "bg-text-primary/40 dark:bg-white/40",
  resolved: "bg-text-primary/40 dark:bg-white/40",
};

const EASE = [0.16, 1, 0.3, 1] as const;
/** The time window shown (mock: fixed; live: the last 3 hours, see lib/api/data.tsx). */
type Win = SeismoData["timelineWindow"];
/** Slot edges that fall on a full hour. */
const hourSlots = (w: Win) => Array.from({ length: w.buckets }, (_, i) => i).filter((i) => i > 0 && (w.start + i * w.bucketMs) % 3_600_000 === 0);

export function bucketOf(timestamp: string, w: Win): number {
  return Math.floor((Date.parse(timestamp) - w.start) / w.bucketMs);
}

function hhmm(ms: number): string {
  const d = new Date(ms);
  return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
}

function buildBuckets(items: TimelineItem[], w: Win): Bucket[] {
  const buckets: Bucket[] = Array.from({ length: w.buckets }, (_, index) => ({
    index,
    events: [],
    deploys: [],
    worst: null,
  }));
  for (const item of items) {
    const b = buckets[bucketOf(item.timestamp, w)];
    if (!b) continue;
    if (item.type === "deploy") {
      b.deploys.push(item.commitMessage);
    } else {
      b.events.push({ title: item.title, severity: item.severity });
      if (b.worst === null || RANK[item.severity] < RANK[b.worst]) b.worst = item.severity;
    }
  }
  return buckets;
}

function barHeight(b: Bucket): number {
  return b.worst ? Math.min(HEIGHT[b.worst] + (b.events.length - 1) * 8, 100) : 0;
}

function Tooltip({ bucket, height, w }: { bucket: Bucket; height: number; w: Win }) {
  const start = w.start + bucket.index * w.bucketMs;
  const edge = bucket.index < 2 ? "left-0" : bucket.index >= w.buckets - 2 ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.97 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      style={{ bottom: "calc(" + Math.max(height, 4) + "% + 10px)" }}
      className={cn(
        "pointer-events-none absolute z-30 w-max max-w-[260px] rounded border border-box-outline bg-section px-3 py-2 text-left font-aeonik-mono text-[11px] shadow-lg dark:border-dark-border dark:bg-dark-dash-section",
        edge
      )}
    >
      <div className="text-text-primary/50 dark:text-white/45">
        {hhmm(start)}–{hhmm(start + w.bucketMs)} UTC
      </div>
      {bucket.events.map((e) => (
        <div key={e.title} className="mt-1 flex items-start gap-1.5 text-text-primary dark:text-white">
          <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", DOT_TONE[e.severity])} />
          <span className="leading-snug">{e.title}</span>
        </div>
      ))}
      {bucket.deploys.map((d) => (
        <div key={d} className="mt-1 text-text-primary/60 dark:text-white/60">
          Deploy: {d}
        </div>
      ))}
    </motion.div>
  );
}

interface RangeBarProps {
  items: TimelineItem[];
  selectedBucket: number | null;
  onSelectBucket: (index: number | null) => void;
}

function Stat({ value, label, className, delay }: { value: number; label: string; className: string; delay: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: EASE }}
      className={cn("inline-flex items-end gap-1.5", className)}
    >
      <AnimatedNumber value={value} size={16} weight={500} />
      <span className="pb-px">{label}</span>
    </motion.span>
  );
}

function Legend() {
  const items: { label: string; dot: string }[] = [
    { label: "Breaking", dot: DOT_TONE.breaking },
    { label: "Suspected", dot: DOT_TONE.suspected },
    { label: "Info", dot: DOT_TONE.info },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/50 dark:text-white/45">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", i.dot)} />
          {i.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full border border-text-primary/50 dark:border-white/50" />
        Deploy
      </span>
    </div>
  );
}

/** Faint grid, dashed hour lines and the pulsing NOW marker that sit behind the bars. */
function ChartBackdrop({ reduce, nowPct, w }: { reduce: boolean; nowPct: number; w: Win }) {
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-between">
        <span className="h-px w-full bg-box-outline/30 dark:bg-dark-border/35" />
        <span className="h-px w-full bg-box-outline/30 dark:bg-dark-border/35" />
        <span className="h-px w-full bg-box-outline/70 dark:bg-dark-border" />
      </div>

      {hourSlots(w).map((slot) => (
        <motion.span
          key={slot}
          aria-hidden
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          style={{ left: (slot / w.buckets) * 100 + "%" }}
          className="pointer-events-none absolute inset-y-0 w-px border-l border-dashed border-box-outline/60 dark:border-dark-border/60"
        />
      ))}

      <motion.div
        aria-hidden
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1 }}
        style={{ left: nowPct + "%" }}
        className="pointer-events-none absolute inset-y-0 z-20 w-px bg-accent/50"
      >
        <span className="absolute -top-5 left-0 -translate-x-1/2 font-aeonik-mono text-[9px] tracking-wider text-accent">
          NOW
        </span>
        <span className="absolute -bottom-[3px] -left-[3px] h-[7px] w-[7px] animate-pulse rounded-full bg-accent" />
      </motion.div>
    </>
  );
}

interface BarSlotProps {
  bucket: Bucket;
  reduce: boolean;
  selectedBucket: number | null;
  hovered: number | null;
  setHovered: (index: number | null) => void;
  onSelectBucket: (index: number | null) => void;
  w: Win;
}

/** One 15-minute column: the bar (or an empty tick), its hover tooltip and the click target. */
function BarSlot({ bucket: b, reduce, selectedBucket, hovered, setHovered, onSelectBucket, w }: BarSlotProps) {
  const isSelected = selectedBucket === b.index;
  const h = barHeight(b);
  const dimmed = b.worst && !isSelected && selectedBucket !== null;
  const delay = 0.1 + b.index * 0.05;
  const hasContent = b.events.length + b.deploys.length > 0;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={hhmm(w.start + b.index * w.bucketMs) + ": " + b.events.length + " changes"}
        aria-pressed={isSelected}
        disabled={!hasContent}
        onClick={() => onSelectBucket(isSelected ? null : b.index)}
        onMouseEnter={() => setHovered(b.index)}
        onMouseLeave={() => setHovered(null)}
        onFocus={() => setHovered(b.index)}
        onBlur={() => setHovered(null)}
        className={cn(
          "group flex h-full w-full items-end justify-center rounded-sm transition-colors disabled:cursor-default",
          isSelected
            ? "bg-dash-bg/80 dark:bg-white/[0.06]"
            : "enabled:hover:bg-dash-bg/50 dark:enabled:hover:bg-white/[0.03]"
        )}
      >
        {b.worst ? (
          <motion.span
            initial={reduce ? false : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.7, delay, ease: EASE }}
            style={{ height: h + "%", transformOrigin: "bottom" }}
            className={cn(
              "block w-3 rounded-t-[3px] transition-[opacity,filter] sm:w-4 md:w-5 group-hover:brightness-110",
              BAR_TONE[b.worst],
              dimmed && "opacity-30"
            )}
          />
        ) : (
          <motion.span
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay }}
            className="mb-px block h-1 w-3 rounded-full bg-box-outline/70 sm:w-4 md:w-5 dark:bg-dark-border"
          />
        )}
      </button>
      <AnimatePresence>{hovered === b.index && hasContent && <Tooltip bucket={b} height={h} w={w} />}</AnimatePresence>
    </div>
  );
}

/** When did things happen? One bar per 15 minutes; height = severity of the worst event. Click a bar to focus the feed. */
export default function RangeBar({ items, selectedBucket, onSelectBucket }: RangeBarProps) {
  const w = useSeismoData().timelineWindow;
  const reduce = useReducedMotion() ?? false;
  const [hovered, setHovered] = useState<number | null>(null);
  const buckets = buildBuckets(items, w);
  const drifts = items.filter((i): i is TimelineDriftEvent => i.type !== "deploy");
  const countOf = (sev: EventSeverity) => drifts.filter((i) => i.severity === sev).length;
  const nowPct = ((w.now - w.start) / (w.buckets * w.bucketMs)) * 100;

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45">
          Last 3 hours · UTC
        </span>
        <div className="flex items-center gap-4 font-aeonik-mono text-xs">
          <Stat value={countOf("breaking")} label="BREAKING" className="text-accent" delay={0.1} />
          <Stat
            value={countOf("suspected")}
            label="SUSPECTED"
            className="text-warn dark:text-warn-bright"
            delay={0.18}
          />
          <Stat value={countOf("info")} label="INFO" className="text-text-primary/50 dark:text-white/45" delay={0.26} />
        </div>
      </div>

      <div className="relative mt-8 h-28">
        <ChartBackdrop reduce={reduce} nowPct={nowPct} w={w} />
        <div className="relative z-10 grid h-full grid-cols-12">
          {buckets.map((b) => (
            <BarSlot
              key={b.index}
              bucket={b}
              reduce={reduce}
              selectedBucket={selectedBucket}
              hovered={hovered}
              setHovered={setHovered}
              onSelectBucket={onSelectBucket}
              w={w}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-12" aria-hidden>
        {buckets.map((b) => (
          <span key={b.index} className="flex h-3 items-center justify-center">
            {b.deploys.length > 0 && (
              <motion.span
                initial={reduce ? false : { opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.9 }}
                className="h-1.5 w-1.5 rounded-full border border-text-primary/60 bg-section dark:border-white/60 dark:bg-dark-dash-section"
              />
            )}
          </span>
        ))}
      </div>

      <div className="relative mt-1 h-4 font-aeonik-mono text-[10px] text-text-primary/50 dark:text-white/45" aria-hidden>
        {hourSlots(w).map((slot) => (
          <span key={slot} style={{ left: (slot / w.buckets) * 100 + "%" }} className="absolute -translate-x-1/2">
            {hhmm(w.start + slot * w.bucketMs)}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-box-outline/50 pt-3 dark:border-dark-border/50">
        <Legend />
        <p className="font-aeonik-light text-xs text-text-primary/50 dark:text-white/45">
          Click a bar to focus the feed on that window.
        </p>
      </div>
    </Card>
  );
}
