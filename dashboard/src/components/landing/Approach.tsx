"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Threads } from "@/components/ui";
import { PIPELINE, STEPS } from "@/lib/landing";
import Reveal from "./Reveal";
import { useSlideActive } from "./deck/Slide";

/** Slide 6 (dark): three steps, then one response travelling the pipeline. Hover a stage to stop and read it. */
export default function Approach() {
  const active = useSlideActive();
  const [stage, setStage] = useState(0);
  const [held, setHeld] = useState<number | null>(null);
  const shown = held ?? stage;

  useEffect(() => {
    if (!active || held !== null) return;
    const t = window.setInterval(() => setStage((s) => (s + 1) % PIPELINE.length), 1100);
    return () => window.clearInterval(t);
  }, [active, held]);

  return (
    <>
      <div aria-hidden className="absolute inset-0 -z-10">
        <Threads color="#ffffff" accentColor="#ff6e3e" lineCount={60} thickness={0.45} amplitude={1.3} distance={0.5} speed={0.35} angle={-12} taper={0.9} brightness={1} parting={0.5} enableMouseInteraction fade={0.4} opacity={0.3} />
      </div>

      <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col justify-center px-6 py-24 md:px-10 lg:px-16">
        <Reveal depth={0.6}>
          <p className="flex items-center gap-3 font-aeonik-mono text-sm uppercase tracking-[0.15em] text-accent">
            <span className="flex h-7 w-7 items-center justify-center rounded border border-accent text-xs">4</span>
            How it works
          </p>
        </Reveal>
        <Reveal depth={1}>
          <h2 className="mt-6 max-w-4xl font-aeonik text-4xl leading-[0.98] tracking-tight md:text-6xl short:md:text-5xl">Three steps. No proxy. Nothing in your request path.</h2>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-3 short:mt-7">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} depth={1.4 + i * 0.3}>
              <div className="h-full rounded-lg border border-white/15 bg-white/[0.04] p-5 backdrop-blur-sm transition-colors hover:border-accent/70 hover:bg-white/[0.08]">
                <p className="font-aeonik-mono text-sm text-accent">{s.n}</p>
                <h3 className="mt-4 font-aeonik text-xl tracking-tight">{s.title}</h3>
                <p className="mt-2 font-aeonik-light text-sm leading-relaxed text-white/65">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal depth={2.4} className="mt-10 short:mt-7">
          <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-white/45">One response, start to finish · hover a stage</p>
          <div className="relative mt-4">
            <span aria-hidden className="absolute left-0 right-0 top-1/2 h-px bg-white/15" />
            <motion.span
              aria-hidden
              className="absolute top-1/2 h-px bg-accent"
              animate={{ width: ((shown + 1) / PIPELINE.length) * 100 + "%" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
            <ol className="relative grid grid-cols-3 gap-3 lg:grid-cols-6">
              {PIPELINE.map((p, i) => (
                <li key={p.name}>
                  <button
                    type="button"
                    onPointerEnter={() => setHeld(i)}
                    onPointerLeave={() => setHeld(null)}
                    onFocus={() => setHeld(i)}
                    onBlur={() => setHeld(null)}
                    className={cn(
                      "w-full rounded-md border px-3 py-2.5 text-left font-aeonik-mono text-[11px] uppercase tracking-wider transition-all duration-300",
                      i === shown ? "border-accent bg-accent text-white" : i < shown ? "border-accent/50 bg-btn-primary text-white" : "border-white/20 bg-btn-primary text-white/60"
                    )}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={shown}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 font-aeonik-light text-base text-white/75"
            >
              {PIPELINE[shown].detail} <span className="text-white/40">AI sits beside this line, not on it.</span>
            </motion.p>
          </AnimatePresence>
        </Reveal>
      </div>
    </>
  );
}
