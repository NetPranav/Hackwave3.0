"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

const NAME = "SEISMO".split("");

/**
 * Slide 1: the title. The seismograph draws itself first, then SEISMO rises letter by letter out of it,
 * then the tagline and the two strips. On the next step everything here leaves and only the line stays.
 */
export default function TitleScene({ step }: { step: number }) {
  const root = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const running = useRef<gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const intro = first.current;
      first.current = false;
      const delay = intro ? 1.1 : 0.15;

      // A pending intro must not fire after you have already moved on (e.g. the deck opened at /deck#11).
      running.current?.kill();

      if (step === 0) {
        const tl = gsap.timeline({ delay });
        running.current = tl;
        tl.fromTo(q("[data-letter]"), { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.07 }, 0);
        tl.fromTo(q("[data-intro]"), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out" }, 0.1);
        tl.fromTo(q("[data-tagline]"), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: "power3.out" }, 0.45);
        tl.fromTo(q("[data-readout]"), { opacity: 0 }, { opacity: 1, duration: 0.8, ease: "power2.out" }, 0.8);
        tl.fromTo(q("[data-strip='top']"), { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out" }, 0.6);
        tl.fromTo(q("[data-strip='bottom']"), { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out" }, 0.7);
      } else {
        const tl = gsap.timeline();
        running.current = tl;
        tl.to(q("[data-letter]"), { yPercent: -110, duration: 0.7, ease: "power3.in", stagger: 0.04 }, 0);
        tl.to(q("[data-intro], [data-tagline], [data-readout]"), { y: -40, opacity: 0, duration: 0.5, ease: "power2.in" }, 0);
        tl.to(q("[data-strip='top']"), { y: -60, opacity: 0, duration: 0.6, ease: "power2.in" }, 0.1);
        tl.to(q("[data-strip='bottom']"), { y: 60, opacity: 0, duration: 0.6, ease: "power2.in" }, 0.1);
      }
    },
    { dependencies: [step], scope: root }
  );

  return (
    <div ref={root} className="pointer-events-none absolute inset-0">
      <div data-strip="top" className="absolute inset-x-24 top-14 flex items-center justify-between border-b-2 border-text-primary pb-5 font-aeonik-mono text-[24px] uppercase tracking-[0.18em] text-text-primary opacity-0">
        <span>HackWave 3.0</span>
        <span>PS 3 &middot; The Internet After the API</span>
      </div>

      <p data-intro className="absolute left-24 top-[214px] font-aeonik-mono text-[26px] uppercase tracking-[0.35em] text-accent opacity-0">
        Introducing
      </p>

      <h1 aria-label="Seismo" className="absolute left-[84px] top-[244px] flex font-aeonik text-[330px] leading-[0.95] tracking-[-0.02em] text-text-primary">
        {NAME.map((l, i) => (
          <span key={i} aria-hidden className="inline-block overflow-hidden">
            <span data-letter className="inline-block">
              {l}
            </span>
          </span>
        ))}
      </h1>

      <p data-tagline className="absolute left-24 top-[600px] font-aeonik text-[64px] leading-none tracking-tight text-text-primary opacity-0">
        Dependabot for the <span className="text-accent">APIs you depend on.</span>
      </p>

      <div data-readout className="absolute inset-x-24 top-[716px] flex items-center justify-between font-aeonik-mono text-[20px] uppercase tracking-[0.2em] text-text-primary opacity-0">
        <span>Live API signal</span>
        <span className="flex items-center gap-3 text-ok">
          <span className="h-3 w-3 rounded-full bg-ok" />
          Stable
        </span>
      </div>

      <div data-strip="bottom" className="absolute inset-x-24 bottom-14 flex items-center justify-between border-t-2 border-text-primary pt-6 font-aeonik-mono uppercase text-text-primary opacity-0">
        <span className="flex items-center gap-5 text-[26px] tracking-[0.3em]">
          Team
          <span className="rounded-md bg-accent px-5 py-2 text-[30px] font-medium tracking-[0.25em] text-white">XERO</span>
        </span>
        <span className="text-[24px] tracking-[0.18em]">Track &middot; Resilient Infrastructure</span>
      </div>
    </div>
  );
}
