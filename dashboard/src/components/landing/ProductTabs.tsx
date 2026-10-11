"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import Reveal from "./Reveal";

type TabId = "detect" | "map" | "fix";

const TABS: { id: TabId; label: string; caption: string }[] = [
  { id: "detect", label: "Detect", caption: "Learn what normal looks like. Flag the moment it changes." },
  { id: "map", label: "Map", caption: "See exactly which code reads the field that changed." },
  { id: "fix", label: "Fix", caption: "Get a small, safe pull request. A person merges it." },
];

/** Share of responses that contain the field, per day. It drops on day 10 and Seismo flags it. */
const BARS = [100, 100, 99, 100, 100, 100, 99, 100, 100, 6, 0, 0, 0, 0];

function DetectPanel() {
  return (
    <div>
      <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50">customer_id · share of responses that contain it</p>
      <div className="mt-5 flex h-44 items-end gap-2">
        {BARS.map((v, i) => (
          <div key={i} className="relative flex h-full flex-1 items-end">
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.5, delay: i * 0.03, ease: "easeOut" }}
              style={{ height: Math.max(v, 2) + "%" }}
              className={cn("w-full origin-bottom rounded-sm", v < 50 ? "bg-accent" : "bg-dash-graph")}
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-md border border-accent/50 bg-accent/10 px-4 py-3">
        <span aria-hidden className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" />
        <p className="font-aeonik text-sm">Day 10: customer_id vanished from 94% of responses. A new field, customerId, appeared in its place.</p>
      </div>
    </div>
  );
}

const CHAIN = ["Payments API", "/payments", "amount", "total.ts", "Checkout"];

function MapPanel() {
  return (
    <div>
      <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50">The path from the change to what it breaks</p>
      <div className="mt-8 flex flex-wrap items-center gap-y-4">
        {CHAIN.map((node, i) => (
          <div key={node} className="flex items-center">
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 * i, duration: 0.3 }}
              className={cn(
                "rounded-md border px-3 py-2 font-aeonik-mono text-xs",
                i >= 2 ? "border-accent bg-accent/10 text-accent" : "border-box-outline bg-section"
              )}
            >
              {node}
            </motion.span>
            {i < CHAIN.length - 1 && <span aria-hidden className={cn("mx-2 h-px w-6 sm:w-10", i >= 1 ? "bg-accent" : "bg-box-outline")} />}
          </div>
        ))}
      </div>
      <p className="mt-8 max-w-lg font-aeonik-light text-sm leading-relaxed text-text-primary/70">
        The field is read in <span className="font-aeonik-mono text-[0.9em]">src/checkout/total.ts:88</span>, and it decides what a customer is charged. That puts Checkout at risk, so this change is marked breaking.
      </p>
    </div>
  );
}

function FixPanel() {
  return (
    <div>
      <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50">seismo/aliases.json · the only file this pull request touches</p>
      <pre className="mt-5 overflow-x-auto rounded-md border border-box-outline bg-inset p-4 font-aeonik-mono text-[13px] leading-relaxed">
        <span className="text-text-primary/40">{"  \"rules\": ["}</span>
        {"\n"}
        <span className="block bg-ok/10 text-ok">{"+   { \"source\": \"customer_id\", \"target\": \"customerId\" }"}</span>
        <span className="text-text-primary/40">{"  ]"}</span>
      </pre>
      <div className="mt-4 flex flex-wrap items-center gap-3 font-aeonik-mono text-xs">
        <span className="rounded border border-ok/40 bg-ok/10 px-2.5 py-1 text-ok">PR #7 · ALL 8 SAFETY CHECKS PASSED</span>
        <span className="text-text-primary/50">Adds a name only when it is missing. Your old field always wins.</span>
      </div>
    </div>
  );
}

/** Scorecard-style tab strip: three one-line stories of what Seismo does, each with a small live picture. */
export default function ProductTabs() {
  const [tab, setTab] = useState<TabId>("detect");
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <section className="mx-auto max-w-[1440px] px-6 pb-24 md:px-10 lg:px-16">
      <Reveal>
        <div role="tablist" aria-label="What Seismo does" className="flex gap-1.5 pl-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-t-lg border border-b-0 px-7 py-2.5 font-aeonik-mono text-xs uppercase tracking-wider transition-colors",
                tab === t.id ? "border-box-outline bg-section text-text-primary" : "border-transparent text-text-primary/50 hover:text-text-primary"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid gap-8 rounded-xl border border-box-outline bg-section p-6 md:p-10 lg:grid-cols-[320px_1fr] lg:gap-14">
          <p className="font-aeonik-mono text-sm uppercase leading-relaxed tracking-wide">{current.caption}</p>
          <div className="min-h-[300px]" role="tabpanel">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {tab === "detect" && <DetectPanel />}
                {tab === "map" && <MapPanel />}
                {tab === "fix" && <FixPanel />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <p className="mt-3 text-right font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/40">Sample data from a demo shop, for illustration</p>
      </Reveal>
    </section>
  );
}
