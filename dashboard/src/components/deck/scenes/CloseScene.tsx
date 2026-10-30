"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

/** The step this scene owns. */
const CLOSE = 14;

const LINES = [
  { text: "Know first.", accent: false },
  { text: "See what breaks.", accent: false },
  { text: "Fix it safely.", accent: true },
];

/** Slide 9: the promise in three lines, then thank you. The strips echo the title slide. */
export default function CloseScene({ step }: { step: number }) {
  const root = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      if (!mounted.current) {
        mounted.current = true;
        gsap.set(q("[data-line]"), { yPercent: 110 });
        gsap.set(q("[data-close]"), { y: 30, opacity: 0 });
      }
      if (step === CLOSE) {
        gsap.to(q("[data-line]"), { yPercent: 0, duration: 1, ease: "expo.out", delay: 0.4, stagger: 0.25, overwrite: true });
        gsap.to(q("[data-close=thanks]"), { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", delay: 1.6, overwrite: true });
        gsap.to(q("[data-close=strip]"), { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 1.9, overwrite: true });
      } else {
        gsap.to(q("[data-line]"), { yPercent: step < CLOSE ? 110 : -110, duration: 0.5, ease: "power2.in", stagger: 0.05, overwrite: true });
        gsap.to(q("[data-close]"), { y: 30, opacity: 0, duration: 0.4, ease: "power2.in", overwrite: true });
      }
    },
    { dependencies: [step], scope: root }
  );

  return (
    <div ref={root} className="pointer-events-none absolute inset-0">
      <div className="absolute left-24 top-[110px]">
        {LINES.map((l) => (
          <span key={l.text} className="block overflow-hidden pb-[0.08em]">
            <span data-line className={"block font-aeonik text-[150px] leading-[1.02] tracking-tight " + (l.accent ? "text-accent" : "text-text-primary")}>
              {l.text}
            </span>
          </span>
        ))}
      </div>

      <p data-close="thanks" className="absolute right-24 top-[560px] font-aeonik text-[110px] leading-none tracking-tight text-text-primary">
        Thank you<span className="text-accent">.</span>
      </p>

      <div data-close="strip" className="absolute inset-x-24 bottom-14 flex items-center justify-between border-t-2 border-text-primary pt-6 font-aeonik-mono uppercase text-text-primary">
        <span className="flex items-center gap-5 text-[26px] tracking-[0.3em]">
          Team
          <span className="rounded-md bg-accent px-5 py-2 text-[30px] font-medium tracking-[0.25em] text-white">XERO</span>
        </span>
        <span className="text-[24px] tracking-[0.18em]">Seismo &middot; Dependabot for the APIs you depend on</span>
      </div>
    </div>
  );
}
