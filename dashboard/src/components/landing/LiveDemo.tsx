"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import Reveal from "./Reveal";
import SectionLabel from "./SectionLabel";

type Stage = 0 | 1 | 2;

const CHAIN = ["Payments API", "/payments", "customer_id", "total.ts", "Checkout"];

const BUTTON: Record<Stage, string> = {
  0: "Flip the provider to v2",
  1: "Let Seismo open the fix",
  2: "Reset the demo",
};

const STATUS: Record<Stage, { label: string; tone: string; text: string }> = {
  0: { label: "ALL NORMAL", tone: "text-ok", text: "Every field looks the way it always has." },
  1: { label: "BREAKING", tone: "text-accent", text: "customer_id vanished and customerId appeared. Checkout reads customer_id and is now at risk." },
  2: { label: "FIX READY", tone: "text-ok", text: "PR #7 adds one rule to seismo/aliases.json. All 8 safety checks passed. A person merges it." },
};

function Json({ stage, view }: { stage: Stage; view: "api" | "app" }) {
  const renamed = stage >= 1 && view === "api";
  const restored = stage === 2 && view === "app";
  const lines = [
    { k: "id", v: '"pay_81"' },
    renamed ? { k: "customerId", v: '"c_204"', hot: true } : { k: "customer_id", v: '"c_204"', add: restored },
    { k: "amount", v: "1000" },
  ];
  return (
    <pre className="rounded-md border border-box-outline bg-inset p-4 font-aeonik-mono text-[13px] leading-relaxed">
      <span className="text-text-primary/40">{"{"}</span>
      {lines.map((l, i) => (
        <span
          key={l.k}
          className={cn("block pl-4 transition-colors duration-300", l.hot && "bg-accent/10 text-accent", l.add && "bg-ok/10 text-ok")}
        >
          &quot;{l.k}&quot;: {l.v}
          {i < lines.length - 1 ? "," : ""}
        </span>
      ))}
      <span className="text-text-primary/40">{"}"}</span>
    </pre>
  );
}

function Chain({ stage }: { stage: Stage }) {
  return (
    <div className="flex flex-wrap items-center gap-y-3">
      {CHAIN.map((node, i) => {
        const onPath = i >= 2;
        const tone = stage === 0 || !onPath ? "border-box-outline bg-section" : stage === 1 ? "border-accent bg-accent/10 text-accent" : "border-ok/60 bg-ok/10 text-ok";
        return (
          <div key={node} className="flex items-center">
            <span className={cn("relative rounded-md border px-2.5 py-1.5 font-aeonik-mono text-[11px] transition-colors duration-300", tone)}>
              {node}
              {stage === 1 && i === 2 && <span aria-hidden className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-ping rounded-full bg-accent" />}
            </span>
            {i < CHAIN.length - 1 && (
              <span aria-hidden className={cn("mx-1.5 h-px w-4 transition-colors duration-300 sm:w-6", stage === 1 && i >= 1 ? "bg-accent" : stage === 2 && i >= 1 ? "bg-ok" : "bg-box-outline")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Try it: flip a pretend provider to v2, watch the field turn red and the path to Checkout light up, then watch a fix appear. */
export default function LiveDemo() {
  const [stage, setStage] = useState<Stage>(0);
  const next = () => setStage((s) => ((s + 1) % 3) as Stage);
  const status = STATUS[stage];

  return (
    <section id="demo" className="mx-auto max-w-[1440px] px-6 pb-24 md:px-10 lg:px-16">
      <Reveal>
        <SectionLabel n="3" label="Try it" />
        <h2 className="mt-6 max-w-3xl font-aeonik text-4xl leading-[0.98] tracking-tight md:text-6xl">Break an API. Watch what happens.</h2>
        <p className="mt-4 font-aeonik-light text-base text-text-primary/70">A pretend provider, canned data. Nothing leaves this page.</p>
      </Reveal>

      <Reveal className="mt-10 overflow-hidden rounded-xl border border-box-outline bg-section">
        <div className="grid lg:grid-cols-2">
          <div className="space-y-5 border-b border-box-outline p-6 md:p-8 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50">
              <span>What the API sends</span>
              <span className="flex items-center gap-2 normal-case tracking-normal">
                <span className="rounded border border-ok/40 bg-ok/10 px-1.5 py-0.5 text-ok">200 OK</span>
                <span className="rounded border border-ok/40 bg-ok/10 px-1.5 py-0.5 text-ok">Monitor: green</span>
              </span>
            </div>
            <Json stage={stage} view="api" />
            <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50">What your app receives</p>
            <Json stage={stage} view="app" />
          </div>

          <div className="flex flex-col justify-between gap-8 p-6 md:p-8">
            <div>
              <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50">What Seismo sees</p>
              <div className="mt-5">
                <Chain stage={stage} />
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={stage}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-6 rounded-md border border-box-outline bg-dash-bg p-4"
                >
                  <p className={cn("font-aeonik-mono text-xs font-medium tracking-wider", status.tone)}>● {status.label}</p>
                  <p className="mt-2 font-aeonik text-base leading-snug">{status.text}</p>
                </motion.div>
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={next}
              className="w-full rounded-md bg-btn-primary px-6 py-3.5 font-aeonik-mono text-sm uppercase tracking-wider text-white transition-transform hover:scale-[1.02] sm:w-fit"
            >
              {BUTTON[stage]} →
            </button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
