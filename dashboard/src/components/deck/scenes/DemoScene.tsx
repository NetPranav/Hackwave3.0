"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

/** The step that shows the demo card. The next click leaves the deck for the real product (see PitchDeck). */
export const DEMO_STEP = 10;

const ROUTE = ["Demo shop", "Seismo dashboard", "Pull request on GitHub"];

/** Slide 6: the hand-off card before the live demo. Big title, and the route the demo will take. */
export default function DemoScene({ step }: { step: number }) {
  const root = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      if (!mounted.current) {
        mounted.current = true;
        gsap.set(q("[data-demo]"), { y: 40, opacity: 0 });
      }
      if (step === DEMO_STEP) {
        gsap.to(q("[data-demo]"), { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", delay: 0.35, stagger: 0.12, overwrite: true });
      } else {
        gsap.to(q("[data-demo]"), { y: -30, opacity: 0, duration: 0.45, ease: "power2.in", overwrite: true });
      }
    },
    { dependencies: [step], scope: root }
  );

  return (
    <div ref={root} className="pointer-events-none absolute inset-0">
      <p data-demo className="absolute left-24 top-[200px] flex items-center gap-4 font-aeonik-mono text-[26px] uppercase tracking-[0.3em] text-accent">
        <span className="relative flex h-4 w-4">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent" />
          <span className="relative h-4 w-4 rounded-full bg-accent" />
        </span>
        Live, not a recording
      </p>
      <h2 data-demo className="absolute left-24 top-[250px] font-aeonik text-[240px] leading-none tracking-tight text-text-primary">
        Live demo<span className="text-accent">.</span>
      </h2>
      <div data-demo className="absolute inset-x-24 top-[600px] flex items-center gap-6 font-aeonik-mono text-[30px] text-text-primary">
        {ROUTE.map((r, i) => (
          <span key={r} className="flex items-center gap-6">
            <span className="rounded-xl border-[3px] border-text-primary bg-section px-7 py-4">{r}</span>
            {i < ROUTE.length - 1 && <span className="text-accent">&rarr;</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
