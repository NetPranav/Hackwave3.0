"use client";

import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import type { GraphNodeType } from "@/lib/graph/types";

const CHIP =
  "rounded border border-box-outline/70 bg-section/90 backdrop-blur-sm dark:border-dark-border dark:bg-dark-dash-section/90";

const LABEL = "font-aeonik-mono text-[10px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45";

export interface GraphHeadline {
  changedFields: number;
  featuresAtRisk: number;
  untraced: number;
}

/** The headline numbers: what changed, what it reaches, and what the scanner could not follow. */
export function Headline({ stats }: { stats: GraphHeadline }) {
  const items: { label: string; value: number; tone: string; hint?: string }[] = [
    { label: "Fields changed", value: stats.changedFields, tone: "text-accent" },
    { label: "Features at risk", value: stats.featuresAtRisk, tone: "text-text-primary dark:text-white" },
    {
      label: "Not traced",
      value: stats.untraced,
      tone: "text-warn dark:text-warn-bright",
      hint: "Spots where the code builds a field name on the fly, which cannot be followed automatically",
    },
  ];
  return (
    <div className={CHIP + " flex divide-x divide-box-outline/60 dark:divide-dark-border/60"}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2.5 px-3.5 py-2" title={item.hint}>
          <AnimatedNumber value={item.value} size={20} weight={500} className={item.tone} />
          <p className={LABEL}>{item.label}</p>
        </div>
      ))}
    </div>
  );
}

function Swatch({ className }: { className: string }) {
  return <span aria-hidden className={"inline-block h-2 w-2 rounded-[2px] " + className} />;
}

/** What the colours mean. The columns explain themselves with their own titles. */
export function Legend() {
  return (
    <div className={CHIP + " flex items-center gap-4 px-3 py-2 font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/60 dark:text-white/60"}>
      <span className="inline-flex items-center gap-1.5"><Swatch className="bg-accent" /> Breaking</span>
      <span className="inline-flex items-center gap-1.5"><Swatch className="bg-warn dark:bg-warn-bright" /> Suspected</span>
      <span className="inline-flex items-center gap-1.5"><Swatch className="bg-ok dark:bg-ok-bright" /> Fix ready</span>
      <span className="inline-flex items-center gap-1.5"><Swatch className="bg-text-primary/40 dark:bg-white/40" /> Normal</span>
    </div>
  );
}

type PathParts = Record<GraphNodeType, number>;

const PART_LABEL: [keyof PathParts, string, string][] = [
  ["service", "API", "APIs"],
  ["endpoint", "call", "calls"],
  ["field", "field", "fields"],
  ["code", "place in code", "places in code"],
  ["workflow", "feature", "features"],
];

/** The route under the pointer, stage by stage: API → call → field → code → feature. */
export function PathTrail({ stages }: { stages: string[][] }) {
  return (
    <div className={CHIP + " flex max-w-[calc(100vw-3rem)] items-center gap-2 overflow-hidden px-3 py-2 font-aeonik-mono text-[11px] text-text-primary/80 dark:text-white/80"}>
      {stages
        .filter((s) => s.length)
        .map((labels, i) => (
          <span key={i} className="inline-flex items-center gap-2 whitespace-nowrap">
            {i > 0 && <span className="text-accent">→</span>}
            <span>{labels.slice(0, 2).join(", ") + (labels.length > 2 ? " +" + (labels.length - 2) : "")}</span>
          </span>
        ))}
    </div>
  );
}

/** Shown while something is selected: how far the change reaches. */
export function PathSummary({ parts }: { parts: PathParts }) {
  return (
    <div className={CHIP + " flex items-center gap-3 px-3 py-2 font-aeonik-mono text-[11px] text-text-primary/70 dark:text-white/70"}>
      <span className="text-[10px] uppercase tracking-wider text-accent">This path</span>
      {PART_LABEL.map(([key, one, many]) => (
        <span key={key} className="inline-flex items-baseline gap-1.5">
          <span className="text-text-primary dark:text-white">{parts[key]}</span>
          {parts[key] === 1 ? one : many}
        </span>
      ))}
    </div>
  );
}
