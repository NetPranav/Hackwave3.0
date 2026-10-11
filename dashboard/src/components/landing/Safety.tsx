"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { GUARANTEES, LADDER } from "@/lib/landing";
import AliasPlayground, { CASES, type CaseId } from "./AliasPlayground";
import Reveal from "./Reveal";
import SectionLabel from "./SectionLabel";

/** Slide 8: try the alias rule yourself; the guarantee it shows lights up on the right. The ladder sits below. */
export default function Safety() {
  const [caseId, setCaseId] = useState<CaseId>("new");
  const lit = CASES.find((c) => c.id === caseId)?.guarantee;

  return (
    <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col justify-center px-6 py-24 md:px-10 lg:px-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Reveal depth={0.6}>
            <SectionLabel n="6" label="Fix safely" />
          </Reveal>
          <Reveal depth={1}>
            <h2 className="mt-6 font-aeonik text-4xl leading-[0.98] tracking-tight md:text-6xl short:md:text-5xl">Add only. Never overwrite.</h2>
          </Reveal>
        </div>
        <Reveal depth={1.2}>
          <p className="max-w-sm font-aeonik-light text-base text-text-primary/70">
            A rename fix is one rule in <code className="font-aeonik-mono text-[0.9em]">seismo/aliases.json</code>. The AI never writes code. Try a case.
          </p>
        </Reveal>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-[1.25fr_1fr] short:mt-7">
        <Reveal depth={1.6}>
          <AliasPlayground value={caseId} onChange={setCaseId} />
        </Reveal>
        <div className="grid grid-cols-2 gap-3">
          {GUARANTEES.map((g, i) => (
            <Reveal key={g.id} depth={1.8 + i * 0.2}>
              <div
                className={cn(
                  "h-full rounded-xl border p-4 transition-all duration-300",
                  lit === g.id ? "-translate-y-1 border-accent bg-accent text-white" : "border-box-outline bg-section"
                )}
              >
                <span className={cn("font-aeonik-mono text-xs", lit === g.id ? "text-white" : "text-accent")}>{g.id}</span>
                <h3 className="mt-3 font-aeonik text-lg leading-tight tracking-tight">{g.title}</h3>
                <p className={cn("mt-1.5 font-aeonik-light text-sm leading-snug", lit === g.id ? "text-white/85" : "text-text-primary/65")}>{g.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <Reveal depth={2.6} className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-2 font-aeonik-mono text-[11px] uppercase tracking-wider">
        {LADDER.map((l, i) => (
          <span key={l.step} className="flex items-center gap-2">
            <span className={cn("rounded border px-2.5 py-1.5", i === 0 ? "border-ok/50 text-ok" : "border-box-outline text-text-primary/70")}>
              {l.step} · {l.who}
            </span>
            {i < LADDER.length - 1 && <span className="text-text-primary/30">→</span>}
          </span>
        ))}
        <span className="ml-2 normal-case tracking-normal text-text-primary/50">Money, branching and saved-data fields always go to review. Each guarantee: property tests, 10,000 runs each.</span>
      </Reveal>
    </div>
  );
}
