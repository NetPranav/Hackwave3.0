"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import type { Signal } from "../Seismograph";

/** Steps this scene owns: Detect, Impact, Fix. */
const DETECT = 7;
const IMPACT = 8;
const FIX = 9;

const WORDS = [
  { word: "Detect.", line: "A read-only SDK learns what normal responses look like. Plain code flags the moment one changes." },
  { word: "Impact.", line: "Seismo maps your repository, so it knows exactly which code reads the changed field." },
  { word: "Fix.", line: "It opens a one-line, additive fix as a pull request. A person reviews and merges it." },
];

/** The path from the change to what it breaks. The middle node sits right under the tremor. */
const CHAIN = ["Payments API", "GET /payments", "amount", "checkout/total.ts", "Checkout"];
const NODE_X = [260, 610, 960, 1310, 1660];
const NODE_W = 290;
const NODE_Y = 740;
const NODE_H = 84;

const ORANGE = "#ff6e3e";
const GREEN = "#2e7d32";
const INK = "#1a1918";

/**
 * Slide 5, three clicks. Detect: a tremor hits the line and Seismo frames it. Impact: a path runs from the tremor
 * to the code that reads the field. Fix: a pull request with one alias rule; the tremor settles and the path turns green.
 */
export default function SolutionScene({ step, signal }: { step: number; signal: React.RefObject<Signal> }) {
  const root = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      if (!mounted.current) {
        mounted.current = true;
        gsap.set(q("[data-sol]"), { y: 30, opacity: 0 });
        gsap.set(q("[data-wire]"), { strokeDashoffset: 1 });
      }
      const on = step >= DETECT && step <= FIX;
      const show = (sel: string, at = 0, stagger = 0) => gsap.to(q(sel), { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: at, stagger, overwrite: true });
      const hide = (sel: string) => gsap.to(q(sel), { y: -24, opacity: 0, duration: 0.4, ease: "power2.in", overwrite: true });
      const tremor = (v: number, at: number) => gsap.to(signal.current, { s2: v, duration: v ? 0.6 : 1.2, delay: at, ease: v ? "power2.out" : "power2.inOut", overwrite: "auto" });
      const wires = (v: number, at = 0) => gsap.to(q("[data-wire]"), { strokeDashoffset: v, duration: v ? 0.3 : 0.9, delay: at, ease: "power2.inOut", stagger: v ? 0 : 0.12, overwrite: true });
      const tint = (colour: string, at = 0) =>
        gsap.to(q("[data-node-hot]"), { borderColor: colour, color: colour, duration: 0.6, delay: at, stagger: 0.08, overwrite: "auto" });

      if (!on) {
        hide("[data-sol]");
        wires(1);
        if (signal.current.s2 > 0 && step < DETECT) tremor(0, 0);
        if (step > FIX) tremor(0, 0);
        return;
      }

      const i = step - DETECT;
      WORDS.forEach((_, w) => (w === i ? show("[data-word=\"" + w + "\"]", 0.35) : hide("[data-word=\"" + w + "\"]")));
      show("[data-sol=rail]", 0.2);
      gsap.to(q("[data-rail-item]"), { opacity: (n: number) => (n === i ? 1 : 0.35), duration: 0.4, overwrite: "auto" });

      // Detect: the tremor and the frame around it. Stays through Impact; settles on Fix.
      tremor(step === FIX ? 0 : 1, step === FIX ? 0.9 : 0.6);
      show("[data-sol=frame]", step === DETECT ? 1.1 : 0);
      gsap.to(q("[data-frame-state=hot]"), { opacity: step === FIX ? 0 : 1, duration: 0.4, delay: step === FIX ? 0.9 : 0, overwrite: "auto" });
      gsap.to(q("[data-frame-state=ok]"), { opacity: step === FIX ? 1 : 0, duration: 0.4, delay: step === FIX ? 1.1 : 0, overwrite: "auto" });

      // Impact: the wire and the chain.
      if (step >= IMPACT) {
        wires(0, step === IMPACT ? 0.5 : 0);
        show("[data-sol=node]", step === IMPACT ? 0.7 : 0, 0.1);
      } else {
        wires(1);
        hide("[data-sol=node]");
      }

      // Fix: the pull request, and the path turns green.
      if (step === FIX) {
        show("[data-sol=pr]", 0.4);
        tint(GREEN, 1.1);
        gsap.to(q("[data-wire]"), { stroke: GREEN, duration: 0.6, delay: 1.1, overwrite: "auto" });
      } else {
        hide("[data-sol=pr]");
        tint(ORANGE);
        gsap.to(q("[data-wire]"), { stroke: ORANGE, duration: 0.3, overwrite: "auto" });
      }
    },
    { dependencies: [step], scope: root }
  );

  return (
    <div ref={root} className="pointer-events-none absolute inset-0">
      <div data-sol="rail" className="absolute inset-x-24 top-[72px] flex items-center justify-between font-aeonik-mono text-[22px] uppercase tracking-[0.2em] text-text-primary">
        <span>How Seismo works</span>
        <span className="flex gap-10">
          {WORDS.map((w, n) => (
            <span key={w.word} data-rail-item className="flex items-center gap-3">
              <span className="text-accent">0{n + 1}</span>
              {w.word.replace(".", "")}
            </span>
          ))}
        </span>
      </div>

      {WORDS.map((w, n) => (
        <div key={w.word} data-sol data-word={n} className="absolute inset-x-24 top-[130px] flex items-end gap-16">
          <h2 className="shrink-0 font-aeonik text-[150px] leading-none tracking-tight text-text-primary">
            {w.word.slice(0, -1)}
            <span className="text-accent">.</span>
          </h2>
          <p className="pb-4 font-aeonik text-[38px] leading-[1.2] tracking-tight text-text-primary">{w.line}</p>
        </div>
      ))}

      <div data-sol="frame" className="absolute left-[800px] top-[340px] h-[260px] w-[320px]">
        <div data-frame-state="hot" className="absolute inset-0 rounded-2xl border-[3px] border-dashed border-accent">
          <span className="absolute -top-[46px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-accent px-4 py-1.5 font-aeonik-mono text-[20px] uppercase tracking-[0.15em] text-white">
            Change detected &middot; amount &rarr; total_amount
          </span>
        </div>
        <div data-frame-state="ok" className="absolute inset-0 rounded-2xl border-[3px] border-ok opacity-0">
          <span className="absolute -top-[46px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ok px-4 py-1.5 font-aeonik-mono text-[20px] uppercase tracking-[0.15em] text-white">
            Fix ready &middot; one alias rule
          </span>
        </div>
      </div>

      <svg aria-hidden className="absolute inset-0 h-[1080px] w-[1920px]" viewBox="0 0 1920 1080">
        <path data-wire d={"M 960 600 L 960 " + NODE_Y} pathLength={1} strokeDasharray="1" fill="none" stroke={ORANGE} strokeWidth={3} />
        {NODE_X.slice(0, -1).map((x, n) => (
          <path
            key={x}
            data-wire
            d={"M " + (x + NODE_W / 2) + " " + (NODE_Y + NODE_H / 2) + " L " + (NODE_X[n + 1] - NODE_W / 2) + " " + (NODE_Y + NODE_H / 2)}
            pathLength={1}
            strokeDasharray="1"
            fill="none"
            stroke={ORANGE}
            strokeWidth={3}
          />
        ))}
      </svg>

      {CHAIN.map((label, n) => {
        const hot = n >= 2;
        return (
          <div
            key={label}
            data-sol="node"
            data-node-hot={hot ? "" : undefined}
            className="absolute flex items-center justify-center rounded-xl border-[3px] bg-section font-aeonik-mono text-[23px]"
            style={{ left: NODE_X[n] - NODE_W / 2, top: NODE_Y, width: NODE_W, height: NODE_H, borderColor: hot ? ORANGE : INK, color: hot ? ORANGE : INK }}
          >
            {label}
          </div>
        );
      })}

      <div data-sol="pr" className="absolute inset-x-24 top-[880px] flex items-center justify-between rounded-2xl border-[3px] border-text-primary bg-section px-10 py-7 shadow-[10px_10px_0_0_var(--color-text-primary)]">
        <div>
          <p className="font-aeonik-mono text-[20px] uppercase tracking-[0.18em] text-text-primary">Pull request #7 &middot; seismo/aliases.json</p>
          <p className="mt-3 font-aeonik-mono text-[30px] leading-none text-text-primary">
            <span className="text-ok">+</span> {"{ "}&quot;target&quot;: &quot;amount&quot;, &quot;source&quot;: &quot;total_amount&quot;{" }"}
          </p>
        </div>
        <div className="text-right font-aeonik-mono text-[22px] uppercase tracking-[0.15em]">
          <p className="text-ok">&#10003; 8 / 8 safety checks</p>
          <p className="mt-2 text-text-primary">Awaiting your review</p>
        </div>
      </div>
    </div>
  );
}
