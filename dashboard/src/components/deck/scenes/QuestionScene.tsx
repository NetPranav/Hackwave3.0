"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

const QUESTION = ["Who", "watches", "the", "APIs", "you", "depend", "on?"];
const ACCENT_WORDS = new Set(["watches"]);

/** Steps this scene owns: the question alone, then the answer in the same space. */
const ASK = 5;
const ANSWER = 6;

/**
 * Slide 4, two clicks. Step 5: one question, nothing else on stage. Step 6: the question lifts away
 * and the answer lands in its place.
 */
export default function QuestionScene({ step }: { step: number }) {
  const root = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const words = q("[data-word]");
      const answer = q("[data-answer]");
      if (!mounted.current) {
        mounted.current = true;
        gsap.set(words, { yPercent: 110 });
      }

      if (step === ASK) {
        gsap.to(answer, { y: 60, opacity: 0, duration: 0.4, ease: "power2.in", overwrite: true });
        gsap.fromTo(words, { yPercent: 110 }, { yPercent: 0, duration: 1, ease: "expo.out", stagger: 0.08, delay: 0.45, overwrite: true });
      } else if (step === ANSWER) {
        gsap.to(words, { yPercent: -110, duration: 0.6, ease: "power3.in", stagger: 0.03, overwrite: true });
        gsap.fromTo(answer, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", stagger: 0.15, delay: 0.55, overwrite: true });
      } else {
        gsap.to(words, { yPercent: step < ASK ? 110 : -110, duration: 0.5, ease: "power2.in", stagger: 0.02, overwrite: true });
        gsap.to(answer, { y: -40, opacity: 0, duration: 0.4, ease: "power2.in", overwrite: true });
      }
    },
    { dependencies: [step], scope: root }
  );

  return (
    <div ref={root} className="pointer-events-none absolute inset-0">
      <h2 aria-label={QUESTION.join(" ")} className="absolute inset-x-24 top-[170px] flex flex-wrap gap-x-[0.24em] font-aeonik text-[176px] leading-[1.02] tracking-tight text-text-primary">
        {QUESTION.map((w, i) => (
          <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.12em]">
            <span data-word className={"inline-block " + (ACCENT_WORDS.has(w) ? "text-accent" : "")}>
              {w}
            </span>
          </span>
        ))}
      </h2>

      <div className="absolute inset-x-24 top-[250px]">
        <p data-answer className="font-aeonik-mono text-[26px] uppercase tracking-[0.3em] text-accent opacity-0">
          The answer
        </p>
        <p data-answer className="mt-6 font-aeonik text-[240px] leading-[0.9] tracking-tight text-text-primary opacity-0">
          Seismo<span className="text-accent">.</span>
        </p>
        <p data-answer className="mt-10 max-w-[1500px] font-aeonik text-[52px] leading-[1.15] tracking-tight text-text-primary opacity-0">
          It detects silent API changes, shows the code they affect, and opens a safe fix.
        </p>
      </div>
    </div>
  );
}
