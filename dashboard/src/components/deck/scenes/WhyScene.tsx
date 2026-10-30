"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

/** The step this scene owns. */
const WHY = 12;

type Mark = "yes" | "partial" | "no";

/**
 * Our reading of their public material (docs/PS/competitors.md, vendor claims): drift pollers such as
 * FlareCanary and DriftGuard; observability tools such as Postman Insights and Datadog APM.
 */
const COLUMNS = [
  { name: "Drift pollers", examples: "FlareCanary, DriftGuard" },
  { name: "Observability", examples: "Postman Insights, Datadog" },
  { name: "Seismo", examples: "Team XERO" },
];

const ROWS: { label: string; marks: [Mark, Mark, Mark] }[] = [
  { label: "Spots shape changes", marks: ["yes", "partial", "yes"] },
  { label: "Learns from your real traffic", marks: ["no", "yes", "yes"] },
  { label: "Catches meaning changes (units, enums)", marks: ["no", "no", "yes"] },
  { label: "Knows which of your code breaks", marks: ["no", "no", "yes"] },
  { label: "Opens a safe fix pull request", marks: ["no", "no", "yes"] },
];

const GLYPH: Record<Mark, string> = { yes: "✓", partial: "Partly", no: "—" };

/** Slide 7, one click: the comparison builds row by row and the Seismo column lights up. */
export default function WhyScene({ step }: { step: number }) {
  const root = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      if (!mounted.current) {
        mounted.current = true;
        gsap.set(q("[data-why]"), { y: 30, opacity: 0 });
        gsap.set(q("[data-ours]"), { opacity: 0 });
      }
      if (step === WHY) {
        gsap.to(q("[data-why=head]"), { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 0.3, overwrite: true });
        gsap.to(q("[data-why=cols]"), { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 0.6, overwrite: true });
        gsap.to(q("[data-why=row]"), { y: 0, opacity: 1, duration: 0.7, ease: "power3.out", delay: 0.9, stagger: 0.32, overwrite: true });
        gsap.to(q("[data-ours]"), { opacity: 1, duration: 0.4, delay: 1.25, stagger: 0.32, overwrite: true });
        gsap.to(q("[data-why=note]"), { y: 0, opacity: 1, duration: 0.6, delay: 2.8, overwrite: true });
      } else {
        gsap.to(q("[data-why]"), { y: -24, opacity: 0, duration: 0.4, ease: "power2.in", overwrite: true });
        gsap.to(q("[data-ours]"), { opacity: 0, duration: 0.3, overwrite: true });
      }
    },
    { dependencies: [step], scope: root }
  );

  return (
    <div ref={root} className="pointer-events-none absolute inset-0">
      <h2 data-why="head" className="absolute left-24 top-[110px] whitespace-nowrap font-aeonik text-[82px] leading-none tracking-tight text-text-primary">
        Others watch the shape. <span className="text-accent">We watch the meaning.</span>
      </h2>

      <div className="absolute inset-x-24 top-[270px]">
        <div data-why="cols" className="grid grid-cols-[1fr_330px_330px_330px] border-b-[3px] border-text-primary pb-5">
          <span />
          {COLUMNS.map((c, i) => (
            <div key={c.name} className="text-center">
              <p className={"font-aeonik text-[40px] leading-none tracking-tight " + (i === 2 ? "text-accent" : "text-text-primary")}>{c.name}</p>
              <p className="mt-2 font-aeonik-mono text-[17px] uppercase tracking-[0.12em] text-text-primary/70">{c.examples}</p>
            </div>
          ))}
        </div>

        {ROWS.map((r) => (
          <div key={r.label} data-why="row" className="relative grid grid-cols-[1fr_330px_330px_330px] items-center border-b-2 border-text-primary/20 py-[22px]">
            <span className="font-aeonik text-[38px] leading-none tracking-tight text-text-primary">{r.label}</span>
            {r.marks.map((m, i) => (
              <span key={i} className="relative flex justify-center">
                {i === 2 && <span data-ours className="absolute -inset-y-[22px] inset-x-6 bg-accent" />}
                <span
                  className={
                    "relative font-aeonik " +
                    (i === 2 ? "text-[48px] leading-none text-white" : m === "yes" ? "text-[48px] leading-none text-text-primary" : m === "partial" ? "font-aeonik-mono text-[24px] uppercase tracking-[0.12em] text-text-primary" : "text-[48px] leading-none text-text-primary/40")
                  }
                >
                  {GLYPH[m]}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>

      <p data-why="note" className="absolute inset-x-24 top-[960px] font-aeonik-mono text-[20px] uppercase tracking-[0.12em] text-text-primary">
        Per their public material, which may be out of date. We do not claim to be first. We put these together.
      </p>
    </div>
  );
}
