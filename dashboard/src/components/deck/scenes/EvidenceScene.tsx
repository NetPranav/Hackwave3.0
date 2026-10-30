"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { SHOCK_X, type Signal } from "../Seismograph";

/** Steps this scene owns: the tremors and cards, then the punchline. */
const FIRST = 3;
const LAST = 4;

const CASES = [
  { who: "Research · ICWE 2024", big: "1,970 / 3,075", text: "web APIs did not always flag breaking changes", year: "2024" },
  { who: "Pipedrive", big: "500 → 100", text: "Limit cut quietly. No error.", year: "Jan 2025" },
  { who: "Jira Cloud", big: "= → ≈", text: "Same search, different results.", year: "Oct 2026" },
];

/**
 * Slide 3, two clicks. Step 3: the line becomes a timeline and three real cases hit it one after another,
 * each card pinned to its own tremor. Step 4: the punchline. All three facts are Confirmed (docs/PS/evidence.md).
 */
export default function EvidenceScene({ step, signal }: { step: number; signal: React.RefObject<Signal> }) {
  const root = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const wasOn = useRef(false);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      if (!mounted.current) {
        mounted.current = true;
        gsap.set(q("[data-ev]"), { y: 30 });
      }
      const on = step >= FIRST && step <= LAST;
      const show = (sel: string, at = 0, stagger = 0.12) => gsap.to(q(sel), { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: at, stagger, overwrite: true });
      const hide = (sel: string) => gsap.to(q(sel), { y: -30, opacity: 0, duration: 0.45, ease: "power2.in", overwrite: true });
      const shock = (key: "s1" | "s2" | "s3", value: number, at: number) => gsap.to(signal.current, { [key]: value, duration: value ? 0.5 : 0.6, delay: at, ease: value ? "power2.out" : "power2.in", overwrite: "auto" });

      if (!on) {
        hide("[data-ev]");
        if (wasOn.current) (["s1", "s2", "s3"] as const).forEach((k) => shock(k, 0, 0));
        wasOn.current = false;
        return;
      }
      wasOn.current = true;

      show("[data-ev='head']", 0.3);
      CASES.forEach((_, i) => {
        const at = 0.9 + i * 0.7;
        if (signal.current[(["s1", "s2", "s3"] as const)[i]] < 0.5) shock((["s1", "s2", "s3"] as const)[i], 1, at);
        show(`[data-ev='card-${i}']`, at + 0.15, 0);
      });

      if (step === LAST) {
        show("[data-ev='punch']", 0.3);
      } else {
        hide("[data-ev='punch']");
      }
    },
    { dependencies: [step], scope: root }
  );

  return (
    <div ref={root} className="pointer-events-none absolute inset-0">
      <h2 data-ev="head" className="absolute left-24 top-[96px] font-aeonik text-[104px] leading-none tracking-tight text-text-primary opacity-0">
        Not a one-off. <span className="text-accent">It keeps happening.</span>
      </h2>

      {CASES.map((c, i) => (
        <div key={c.who} data-ev={`card-${i}`} className="absolute top-[268px] w-[480px] opacity-0" style={{ left: SHOCK_X[i] - 240 }}>
          <div className="flex h-[272px] flex-col rounded-2xl border-2 border-text-primary bg-section px-8 py-6 shadow-[8px_8px_0_0_var(--color-text-primary)]">
            <p className="font-aeonik-mono text-[20px] uppercase tracking-[0.18em] text-text-primary">{c.who}</p>
            <p className="mt-3 whitespace-nowrap font-aeonik-mono text-[50px] leading-none tracking-tight text-accent">{c.big}</p>
            <p className="mt-4 font-aeonik text-[28px] leading-tight text-text-primary">{c.text}</p>
            <p className="mt-auto font-aeonik-mono text-[16px] uppercase tracking-[0.15em] text-ok">&#10003; Confirmed</p>
          </div>
          <div className="mx-auto h-[96px] w-0 border-l-2 border-dashed border-text-primary" />
          <p className="mt-[238px] text-center font-aeonik-mono text-[24px] uppercase tracking-[0.2em] text-text-primary">{c.year}</p>
        </div>
      ))}

      <p data-ev="punch" className="absolute inset-x-24 top-[958px] text-center font-aeonik text-[60px] leading-none tracking-tight text-text-primary opacity-0">
        Libraries have Dependabot. <span className="text-accent">Your APIs have nothing.</span>
      </p>
    </div>
  );
}
