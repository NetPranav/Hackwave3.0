"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

const GLYPHS = "abcdefghijklmnopqrstuvwxyz_#%&";

/** Rewrites an element's text from what it shows now to `target`, letter by letter, with noise in between. */
function scramble(el: Element, target: string, duration: number, delay = 0) {
  const from = el.textContent ?? "";
  const state = { p: 0 };
  return gsap.to(state, {
    p: 1,
    duration,
    delay,
    ease: "none",
    onUpdate: () => {
      const len = Math.round(from.length + (target.length - from.length) * state.p);
      const fixed = Math.floor(target.length * state.p);
      let out = "";
      for (let i = 0; i < len; i++) out += i < fixed ? target[i] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      el.textContent = out;
    },
    onComplete: () => {
      el.textContent = target;
    },
  });
}

const TILES = [
  { label: "API", value: "200 OK", ok: true },
  { label: "Monitor", value: "All green", ok: true },
  { label: "Checkout", value: "Broken", ok: false },
];

/**
 * Slide 2, two clicks. Step 1: the quake. The payment response changes `amount` to `total_amount`.
 * Step 2: the quake passes, every signal says fine, and only checkout is broken. Nobody told you.
 */
export default function HookScene({ step }: { step: number }) {
  const root = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const key = q("[data-key]")[0] as HTMLElement;
      const setKey = (text: string, color: string) => {
        key.textContent = text;
        key.style.color = color;
      };
      if (!mounted.current) {
        mounted.current = true;
        gsap.set(q("[data-hook]"), { y: 30 });
        gsap.set(q("[data-tile]"), { y: 40 });
      }
      const show = (sel: string, at = 0) => gsap.to(q(sel), { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: at, stagger: 0.12, overwrite: true });
      const hide = (sel: string, y = -30) => gsap.to(q(sel), { y, opacity: 0, duration: 0.45, ease: "power2.in", overwrite: true });

      if (step < 1 || step > 2) {
        hide("[data-hook]");
        hide("[data-tile]", 40);
        gsap.delayedCall(0.5, () => setKey("amount", "#1a1918"));
        return;
      }

      show("[data-frame]", 0.35);
      show("[data-json]", 0.6);

      if (step === 1) {
        hide("[data-head='after']");
        hide("[data-tile]", 40);
        show("[data-diff]", 2.3);
        hide("[data-readout='stable']", 0);
        show("[data-head='before']", 0.3);
        show("[data-readout='changed']", 0.5);
        if (key.textContent !== "total_amount") {
          setKey("amount", "#1a1918");
          scramble(key, "total_amount", 0.9, 1.3);
          gsap.to(key, { color: "#ff6e3e", duration: 0.3, delay: 1.3 });
          gsap.fromTo(q("[data-json]"), { x: 0 }, { x: 10, duration: 0.05, repeat: 9, yoyo: true, delay: 1.3, ease: "none", clearProps: "x" });
        }
      } else {
        hide("[data-head='before']");
        hide("[data-diff]", 30);
        hide("[data-readout='changed']", 0);
        show("[data-head='after']", 0.35);
        show("[data-readout='stable']", 0.9);
        setKey("total_amount", "#ff6e3e");
        show("[data-tile]", 0.8);
        gsap.fromTo(q("[data-tile='bad']"), { x: 0 }, { x: 12, duration: 0.06, repeat: 7, yoyo: true, delay: 1.9, ease: "none", clearProps: "x" });
      }
    },
    { dependencies: [step], scope: root }
  );

  return (
    <div ref={root} className="pointer-events-none absolute inset-0">
      <h2 data-hook data-head="before" className="absolute left-24 top-[110px] font-aeonik text-[104px] leading-none tracking-tight text-text-primary opacity-0">
        Last night, <span className="text-accent">one field changed.</span>
      </h2>
      <h2 data-hook data-head="after" className="absolute left-24 top-[110px] font-aeonik text-[104px] leading-none tracking-tight text-text-primary opacity-0">
        No email. No error. <span className="text-accent">Nobody told you.</span>
      </h2>

      <div data-hook data-frame className="absolute inset-x-24 top-[290px] flex items-center justify-between font-aeonik-mono text-[22px] uppercase tracking-[0.2em] text-text-primary opacity-0">
        <span>Payments API &middot; live signal</span>
        <span className="relative h-8 w-60">
          <span data-hook data-readout="changed" className="absolute right-0 flex items-center gap-3 text-accent opacity-0">
            <span className="relative flex h-3.5 w-3.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent" />
              <span className="relative h-3.5 w-3.5 rounded-full bg-accent" />
            </span>
            Changed
          </span>
          <span data-hook data-readout="stable" className="absolute right-0 flex items-center gap-3 text-ok opacity-0">
            <span className="h-3.5 w-3.5 rounded-full bg-ok" />
            Stable
          </span>
        </span>
      </div>

      <div data-hook data-json className="absolute left-1/2 top-[640px] -translate-x-1/2 whitespace-nowrap rounded-2xl border-2 border-text-primary bg-section px-12 py-7 font-aeonik-mono text-[46px] leading-none text-text-primary opacity-0 shadow-[10px_10px_0_0_var(--color-text-primary)]">
        <span className="text-text-primary/50">{"{ "}</span>
        &quot;id&quot;: &quot;pay_81&quot;, &quot;<span data-key>amount</span>&quot;: 1000 <span className="text-text-primary/50">{"}"}</span>
      </div>

      <p data-hook data-diff className="absolute inset-x-0 top-[870px] flex justify-center gap-16 font-aeonik-mono text-[40px] leading-none opacity-0">
        <span className="text-text-primary/60 line-through decoration-2">&minus; amount</span>
        <span className="text-accent">+ total_amount</span>
      </p>

      <div className="absolute inset-x-24 top-[850px] grid grid-cols-3 gap-8">
        {TILES.map((t) => (
          <div
            key={t.label}
            data-tile={t.ok ? "ok" : "bad"}
            className={
              "flex items-center justify-between rounded-2xl border-2 px-9 py-7 opacity-0 " +
              (t.ok ? "border-ok bg-section text-ok" : "border-accent bg-accent text-white")
            }
          >
            <span className={"font-aeonik-mono text-[22px] uppercase tracking-[0.2em] " + (t.ok ? "text-text-primary" : "text-white")}>{t.label}</span>
            <span className="flex items-center gap-3 font-aeonik text-[44px] leading-none tracking-tight">
              {t.value}
              <span aria-hidden>{t.ok ? "✓" : "✗"}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
