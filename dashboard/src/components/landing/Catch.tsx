"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CATCHES } from "@/lib/landing";
import Reveal from "./Reveal";
import SectionLabel from "./SectionLabel";

/** Six kinds of silent change. Hover or focus a card and its example flips from before to after. */
export default function Catch() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <section id="catch" className="mx-auto max-w-[1440px] px-6 pb-24 md:px-10 lg:px-16">
      <Reveal>
        <SectionLabel n="2" label="What we catch" />
        <h2 className="mt-6 max-w-3xl font-aeonik text-4xl leading-[0.98] tracking-tight md:text-6xl">Six kinds of silent change.</h2>
        <p className="mt-4 font-aeonik-light text-base text-text-primary/70">Shape, behaviour and meaning. Most tools stop at shape.</p>
      </Reveal>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CATCHES.map((c, i) => {
          const flipped = active === i;
          return (
            <Reveal key={c.title} delay={(i % 3) * 0.07}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="group relative h-full w-full overflow-hidden rounded-xl border border-box-outline bg-section p-6 text-left transition-colors hover:border-text-primary"
              >
                <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5 origin-left bg-accent transition-transform duration-300", flipped ? "scale-x-100" : "scale-x-0")} />
                <div className="flex items-center justify-between">
                  <span className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/45">{c.family}</span>
                  <span className="font-aeonik-mono text-[11px] text-text-primary/30">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-aeonik text-2xl tracking-tight">{c.title}</h3>
                <p className="mt-2 font-aeonik-light text-sm leading-relaxed text-text-primary/65">{c.text}</p>
                <div className="relative mt-6 h-11 overflow-hidden rounded-md border border-box-outline bg-inset font-aeonik-mono text-xs">
                  <span className={cn("absolute inset-0 flex items-center px-3 transition-all duration-300", flipped ? "-translate-y-full opacity-0" : "opacity-100")}>
                    <span className="mr-2 text-text-primary/40">before</span>
                    {c.before}
                  </span>
                  <span className={cn("absolute inset-0 flex items-center px-3 text-accent transition-all duration-300", flipped ? "opacity-100" : "translate-y-full opacity-0")}>
                    <span className="mr-2 text-accent/60">after</span>
                    {c.after}
                  </span>
                </div>
              </button>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
