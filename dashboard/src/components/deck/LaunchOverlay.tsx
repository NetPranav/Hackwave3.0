"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { gsap } from "@/lib/gsap";

/** Set while the browser is on the live demo, so the deck knows to sweep the panel away when you come back. */
const RETURN_KEY = "seismo-deck-return";

export interface LaunchOverlayHandle {
  /** Sweep the panel up over the stage, then open `url`. `resumeAt` is the step the deck reopens on. */
  launch: (url: string, resumeAt: number) => void;
  /**
   * Sweep the panel over the stage, open `url` in a new tab once it covers the screen, then sweep away and call
   * `done`. Falls back to `launch` (same tab) if the browser blocks the tab.
   */
  open: (url: string, resumeAt: number, done: () => void) => void;
}

/** The one page transition in the deck: a dark panel that carries you into the live product and back. */
const LaunchOverlay = forwardRef<LaunchOverlayHandle>(function LaunchOverlay(_, ref) {
  const panel = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLParagraphElement>(null);

  useImperativeHandle(ref, () => ({
    launch(url, resumeAt) {
      window.history.replaceState(null, "", "#" + resumeAt);
      sessionStorage.setItem(RETURN_KEY, "1");
      if (label.current) label.current.textContent = "Switching to the live product";
      const tl = gsap.timeline({ onComplete: () => window.location.assign(url) });
      tl.fromTo(panel.current, { y: 0, yPercent: 100 }, { y: 0, yPercent: 0, duration: 0.8, ease: "power4.inOut" });
      tl.fromTo(text.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.55);
      tl.to({}, { duration: 0.45 });
    },
    open(url, resumeAt, done) {
      if (label.current) label.current.textContent = "Switching to the live product";
      const tl = gsap.timeline({ onComplete: done });
      tl.fromTo(panel.current, { y: 0, yPercent: 100 }, { y: 0, yPercent: 0, duration: 0.7, ease: "power4.inOut" });
      tl.fromTo(text.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.45);
      // Still inside the key press's short permission window, so the browser allows the new tab.
      tl.call(() => {
        const tab = window.open(url, "_blank");
        if (!tab) {
          tl.kill();
          window.history.replaceState(null, "", "#" + resumeAt);
          sessionStorage.setItem(RETURN_KEY, "1");
          window.location.assign(url);
        }
      }, [], 1.05);
      tl.to(text.current, { opacity: 0, duration: 0.3 }, "+=0.6");
      tl.to(panel.current, { yPercent: -100, duration: 0.8, ease: "power4.inOut" });
      tl.set(panel.current, { yPercent: 100 });
    },
  }));

  // Coming back from the demo: start covered, then sweep away to reveal the stage.
  useEffect(() => {
    if (!sessionStorage.getItem(RETURN_KEY)) {
      gsap.set(panel.current, { y: 0, yPercent: 100 });
      return;
    }
    sessionStorage.removeItem(RETURN_KEY);
    gsap.set(panel.current, { y: 0, yPercent: 0 });
    gsap.set(text.current, { opacity: 1 });
    gsap.to(text.current, { opacity: 0, duration: 0.3, delay: 0.6 });
    gsap.to(panel.current, { yPercent: -100, duration: 0.9, ease: "power4.inOut", delay: 0.8 });
  }, []);

  return (
    <div ref={panel} aria-hidden style={{ transform: "translateY(100%)" }} className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-btn-primary">
      <div ref={text} className="flex flex-col items-center gap-6 opacity-0">
        <span className="h-1 w-24 rounded-full bg-accent" />
        <p ref={label} className="font-aeonik text-5xl tracking-tight text-white">
          Switching to the live product
        </p>
      </div>
    </div>
  );
});

export default LaunchOverlay;
