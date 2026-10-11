"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import Reveal from "./Reveal";
import SectionLabel from "./SectionLabel";

type Mode = "today" | "seismo";

const LOOPS: Record<Mode, { steps: string[]; hot: number; note: string; dot: string; speed: string }> = {
  today: {
    steps: ["Build and ship", "Provider changes silently", "A user complains", "Days of debugging"],
    hot: 1,
    note: "Who finds out first: your users.",
    dot: "fill-accent",
    speed: "9s",
  },
  seismo: {
    steps: ["Build and ship", "Seismo flags the change", "A fix PR is opened", "You review and merge"],
    hot: 1,
    note: "Who finds out first: you, with the code that breaks and a fix ready.",
    dot: "fill-ok",
    speed: "4.5s",
  },
};

/** The four corners of the loop, as % of the panel. */
const CORNERS = [
  { left: "18%", top: "22%" },
  { left: "82%", top: "22%" },
  { left: "82%", top: "78%" },
  { left: "18%", top: "78%" },
];

const TRACK = "M 162 70 L 738 70 A 90 90 0 0 1 738 250 L 162 250 A 90 90 0 0 1 162 70 Z";

/** Slide 3: the loop teams live in today, and the same loop with Seismo. A dot runs around it; toggle to compare. */
export default function Problem() {
  const [mode, setMode] = useState<Mode>("today");
  const loop = LOOPS[mode];

  return (
    <div className="mx-auto grid h-full w-full max-w-[1440px] items-center gap-12 px-6 py-24 md:px-10 lg:grid-cols-[0.9fr_1.1fr] lg:px-16">
      <div>
        <Reveal depth={0.6}>
          <SectionLabel n="2" label="The problem" />
        </Reveal>
        <Reveal depth={1}>
          <h2 className="mt-6 font-aeonik text-4xl leading-[0.98] tracking-tight md:text-6xl short:md:text-5xl">Who finds out first?</h2>
        </Reveal>
        <Reveal depth={1.6} className="mt-8 inline-flex rounded-md border border-box-outline bg-section p-1">
          {(["today", "seismo"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "rounded px-4 py-2 font-aeonik-mono text-xs uppercase tracking-wider transition-colors",
                mode === m ? "bg-btn-primary text-white" : "text-text-primary/60 hover:text-text-primary"
              )}
            >
              {m === "today" ? "How it works today" : "With Seismo"}
            </button>
          ))}
        </Reveal>
      </div>

      <Reveal depth={2} className="relative aspect-[900/320] w-full rounded-xl border border-box-outline bg-section">
        <svg viewBox="0 0 900 320" className="absolute inset-0 h-full w-full" aria-hidden>
          <path d={TRACK} fill="none" className="stroke-box-outline" strokeWidth={1.5} />
          <circle r={7} className={cn("transition-colors duration-500", loop.dot)}>
            <animateMotion key={mode} dur={loop.speed} repeatCount="indefinite" path={TRACK} />
          </circle>
        </svg>
        <AnimatePresence mode="wait">
          <motion.div key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="absolute inset-0">
            {loop.steps.map((s, i) => (
              <span
                key={s}
                style={CORNERS[i]}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border bg-section px-3 py-2 font-aeonik-mono text-[11px] uppercase tracking-wider transition-transform hover:scale-105",
                  i === loop.hot ? (mode === "today" ? "border-accent text-accent" : "border-ok text-ok") : "border-box-outline"
                )}
              >
                {s}
              </span>
            ))}
            <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-24 text-center font-aeonik text-base leading-snug md:text-lg">{loop.note}</p>
          </motion.div>
        </AnimatePresence>
      </Reveal>
    </div>
  );
}
