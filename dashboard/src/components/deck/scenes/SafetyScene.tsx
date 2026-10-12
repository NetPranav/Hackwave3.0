"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

/** Steps this scene owns: it watches without touching, then it never acts alone. */
const WATCH = 10;
const RULES = 11;

const CARDS = [
  { title: "AI explains. Code decides.", text: "Detection is plain code. AI only writes the explanation and never sees raw data." },
  { title: "Fixes only add.", text: "A rule fills in the old field when it is missing. The old field always wins." },
  { title: "Money goes to a human.", text: "Changes to money, branching or saved data are never fixed automatically." },
];

const MUTED = "#9a9590";
const INK = "#1a1918";

/**
 * Slide 6, two clicks. Step 10: the line is the request path; the SDK reads a copy beside it, sends only a shape,
 * and when Seismo goes offline the app keeps working. Step 11: the three rules that keep a person in charge.
 */
export default function SafetyScene({ step }: { step: number }) {
  const root = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const offline = useRef<gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      if (!mounted.current) {
        mounted.current = true;
        gsap.set(q("[data-safe]"), { y: 30, opacity: 0 });
        gsap.set(q("[data-tap]"), { scaleY: 0, transformOrigin: "top" });
      }
      const show = (sel: string, at = 0, stagger = 0) => gsap.to(q(sel), { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: at, stagger, overwrite: true });
      const hide = (sel: string) => gsap.to(q(sel), { y: -24, opacity: 0, duration: 0.4, ease: "power2.in", overwrite: true });
      const resetCloud = () => {
        offline.current?.kill();
        gsap.to(q("[data-cloud]"), { borderColor: INK, color: INK, duration: 0.3, overwrite: "auto" });
        gsap.to(q("[data-offline], [data-still-ok]"), { opacity: 0, duration: 0.3, overwrite: "auto" });
        gsap.to(q("[data-packet]"), { opacity: 1, duration: 0.3, overwrite: "auto" });
      };

      if (step !== WATCH && step !== RULES) {
        hide("[data-safe]");
        gsap.to(q("[data-tap]"), { scaleY: 0, duration: 0.3, overwrite: true });
        resetCloud();
        return;
      }

      show("[data-safe=ends]", 0.3);
      if (step === WATCH) {
        hide("[data-safe=head-rules], [data-safe=card]");
        show("[data-safe=head-watch]", 0.35);
        gsap.to(q("[data-tap]"), { scaleY: 1, duration: 0.6, delay: 0.9, ease: "power2.out", overwrite: true });
        show("[data-safe=sdk]", 1.2);
        show("[data-safe=cloud]", 1.6);
        show("[data-safe=chips]", 2, 0.1);

        // Then Seismo goes offline, and nothing happens to the app.
        resetCloud();
        const tl = gsap.timeline({ delay: 3.6 });
        tl.to(q("[data-cloud]"), { borderColor: MUTED, color: MUTED, duration: 0.5 });
        tl.to(q("[data-packet]"), { opacity: 0.15, duration: 0.4 }, 0);
        tl.fromTo(q("[data-offline]"), { scale: 1.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2)" }, 0.2);
        tl.fromTo(q("[data-still-ok]"), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, 0.8);
        offline.current = tl;
      } else {
        hide("[data-safe=head-watch], [data-safe=sdk], [data-safe=cloud], [data-safe=chips]");
        gsap.to(q("[data-tap]"), { scaleY: 0, duration: 0.3, overwrite: true });
        resetCloud();
        show("[data-safe=head-rules]", 0.35);
        show("[data-safe=card]", 0.7, 0.15);
      }
    },
    { dependencies: [step], scope: root }
  );

  return (
    <div ref={root} className="pointer-events-none absolute inset-0">
      <h2 data-safe="head-watch" className="absolute left-24 top-[100px] font-aeonik text-[120px] leading-none tracking-tight text-text-primary">
        It watches. <span className="text-accent">It never touches.</span>
      </h2>
      <h2 data-safe="head-rules" className="absolute left-24 top-[100px] font-aeonik text-[120px] leading-none tracking-tight text-text-primary">
        And it never <span className="text-accent">acts alone.</span>
      </h2>

      <div data-safe="ends">
        <div className="absolute left-24 top-[420px] flex h-[100px] w-[300px] items-center justify-center rounded-2xl border-[3px] border-text-primary bg-section font-aeonik text-[38px] tracking-tight text-text-primary">
          Your app
        </div>
        <div className="absolute right-24 top-[420px] flex h-[100px] w-[300px] items-center justify-center rounded-2xl border-[3px] border-text-primary bg-section font-aeonik text-[38px] tracking-tight text-text-primary">
          Payments API
        </div>
        <p className="absolute left-1/2 top-[408px] -translate-x-1/2 bg-page-bg px-4 font-aeonik-mono text-[20px] uppercase tracking-[0.2em] text-text-primary">Your live traffic</p>
      </div>

      <p data-still-ok className="absolute left-24 top-[540px] flex items-center gap-3 font-aeonik-mono text-[24px] uppercase tracking-[0.15em] text-ok opacity-0">
        &#10003; Checkout still working
      </p>

      <div data-tap className="absolute left-[628px] top-[478px] h-[142px] w-0 border-l-[3px] border-dashed border-accent" />

      <div data-safe="sdk" className="absolute left-[440px] top-[620px] flex h-[120px] w-[380px] flex-col items-center justify-center rounded-2xl border-[3px] border-accent bg-section">
        <p className="font-aeonik text-[36px] leading-none tracking-tight text-text-primary">Seismo SDK</p>
        <p className="mt-2 font-aeonik-mono text-[18px] uppercase tracking-[0.15em] text-accent">Reads a copy only</p>
      </div>

      <div data-safe="cloud">
        <div data-packet className="absolute left-[820px] top-[680px] h-0 w-[660px] border-t-[3px] border-text-primary" />
        <p data-packet className="absolute left-[856px] top-[636px] whitespace-nowrap font-aeonik-mono text-[18px] text-text-primary">amount: number, 4 digits</p>
        <p data-packet className="absolute left-[856px] top-[694px] font-aeonik-mono text-[16px] uppercase tracking-[0.15em] text-ok">Never the value</p>
        <div data-cloud className="absolute left-[1480px] top-[620px] flex h-[120px] w-[344px] items-center justify-center rounded-2xl border-[3px] border-text-primary bg-section font-aeonik text-[36px] tracking-tight text-text-primary">
          Seismo cloud
          <span data-offline className="absolute -top-5 right-6 rounded-md bg-text-primary px-3 py-1 font-aeonik-mono text-[18px] uppercase tracking-[0.2em] text-white opacity-0">
            Offline
          </span>
        </div>
      </div>

      <div className="absolute inset-x-24 top-[860px] flex justify-between">
        {["Read-only", "Fails open", "Not in the request path", "Shapes, not values"].map((c) => (
          <span key={c} data-safe="chips" className="rounded-xl border-[3px] border-text-primary bg-section px-7 py-4 font-aeonik text-[32px] tracking-tight text-text-primary">
            {c}
          </span>
        ))}
      </div>

      <div className="absolute inset-x-24 top-[590px] grid grid-cols-3 gap-8">
        {CARDS.map((c, i) => (
          <div key={c.title} data-safe="card" className="flex h-[370px] flex-col rounded-2xl border-[3px] border-text-primary bg-section p-9 shadow-[10px_10px_0_0_var(--color-text-primary)]">
            <p className="font-aeonik-mono text-[22px] text-accent">0{i + 1}</p>
            <h3 className="mt-4 font-aeonik text-[44px] leading-[1.05] tracking-tight text-text-primary">{c.title}</h3>
            <p className="mt-auto font-aeonik text-[27px] leading-snug text-text-primary">{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
