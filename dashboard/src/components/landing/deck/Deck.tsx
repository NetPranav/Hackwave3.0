"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { gsap } from "@/lib/gsap";

export interface SlideMeta {
  id: string;
  label: string;
  dark?: boolean;
}

interface DeckState {
  active: number;
  enabled: boolean;
  slides: SlideMeta[];
  go: (target: number | string) => void;
}

const DeckContext = createContext<DeckState>({ active: 0, enabled: false, slides: [], go: () => {} });
export const useDeck = () => useContext(DeckContext);

/** Same condition as the `deck` CSS variant in globals.css. Smaller screens scroll normally. */
const QUERY = "(min-width: 1024px) and (min-height: 600px)";
const DURATION = 1.05;
/** How much wheel movement counts as "go to the next slide". Small, so a little scroll is enough. */
const WHEEL_STEP = 24;

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const useDeckEnabled = () => useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);

const depthOf = (el: Element) => Number((el as HTMLElement).dataset.depth ?? 1);
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A presentation deck: each child is one full-screen slide. A small scroll, an arrow key or a swipe moves one slide.
 * Elements marked data-enter slide in at different speeds (data-depth), which gives the parallax on every change.
 */
export default function Deck({ slides, nav, paged = true, children }: { slides: SlideMeta[]; nav?: React.ReactNode; paged?: boolean; children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const lockRef = useRef(false);
  const lastWheelRef = useRef(0);
  const wheelSumRef = useRef(0);
  const [active, setActive] = useState(0);
  // paged={false} keeps a normal scrolling page: no slide snapping, no wheel or key takeover.
  const enabled = useDeckEnabled() && paged;

  const entering = (index: number) => Array.from(trackRef.current?.children[index]?.querySelectorAll("[data-enter]") ?? []);

  const go = useCallback(
    (target: number | string) => {
      const next = typeof target === "string" ? slides.findIndex((s) => s.id === target) : target;
      const from = activeRef.current;
      if (next < 0 || next >= slides.length || next === from) return;
      if (!enabled) {
        document.getElementById(slides[next].id)?.scrollIntoView({ behavior: "smooth" });
        return;
      }
      lockRef.current = true;
      activeRef.current = next;
      setActive(next);
      window.history.replaceState(null, "", "#" + slides[next].id);

      const dir = next > from ? 1 : -1;
      const reduce = reducedMotion();
      const release = () => {
        if (performance.now() - lastWheelRef.current > 220) lockRef.current = false;
        else window.setTimeout(release, 80);
      };
      const tl = gsap.timeline({ onComplete: release });
      tl.to(rootRef.current, { scrollTop: next * window.innerHeight, duration: reduce ? 0 : DURATION, ease: "power3.inOut" }, 0);
      if (reduce) return;
      const outgoing = entering(from);
      const incoming = entering(next);
      tl.to(outgoing, { y: (_i: number, el: Element) => -dir * 80 * depthOf(el), opacity: 0.15, duration: DURATION * 0.85, ease: "power2.in" }, 0);
      tl.fromTo(
        incoming,
        { y: (_i: number, el: Element) => dir * 160 * depthOf(el), opacity: 0 },
        { y: 0, opacity: 1, duration: 0.95, ease: "power3.out", stagger: 0.05 },
        DURATION * 0.3
      );
      tl.set(outgoing, { y: 0, opacity: 1 });
    },
    [enabled, slides]
  );

  // When the deck switches on, jump to the current slide (or the one named in the URL, like /#demo) and play it in.
  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root) return;
    lockRef.current = true;
    let unlock = 0;
    const frame = requestAnimationFrame(() => {
      const fromHash = slides.findIndex((s) => "#" + s.id === window.location.hash);
      const start = fromHash >= 0 ? fromHash : activeRef.current;
      activeRef.current = start;
      setActive(start);
      root.scrollTop = start * window.innerHeight;
      if (!reducedMotion()) {
        gsap.fromTo(
          entering(start),
          { y: (_i: number, el: Element) => 70 * depthOf(el), opacity: 0 },
          { y: 0, opacity: 1, duration: 1, ease: "power3.out", stagger: 0.07, delay: 0.1 }
        );
      }
      unlock = window.setTimeout(() => (lockRef.current = false), 300);
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(unlock);
    };
  }, [enabled, slides]);

  // If anything else scrolls the deck (a focused button, an anchor), settle on the nearest slide.
  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root) return;
    let timer = 0;
    const onScroll = () => {
      if (lockRef.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const h = window.innerHeight;
        const nearest = Math.max(0, Math.min(slides.length - 1, Math.round(root.scrollTop / h)));
        if (nearest !== activeRef.current) {
          activeRef.current = nearest;
          setActive(nearest);
        }
        if (Math.abs(root.scrollTop - nearest * h) > 1) gsap.to(root, { scrollTop: nearest * h, duration: 0.4, ease: "power2.out" });
      }, 120);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      root.removeEventListener("scroll", onScroll);
    };
  }, [enabled, slides.length]);

  // Wheel, keys, swipe and resize, only while the deck is on.
  useEffect(() => {
    if (!enabled) return;
    const step = (delta: number) => go(activeRef.current + delta);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = performance.now();
      if (now - lastWheelRef.current > 200) wheelSumRef.current = 0;
      lastWheelRef.current = now;
      if (lockRef.current) return;
      wheelSumRef.current += e.deltaY;
      if (Math.abs(wheelSumRef.current) >= WHEEL_STEP) {
        const delta = Math.sign(wheelSumRef.current);
        wheelSumRef.current = 0;
        step(delta);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || lockRef.current) return;
      if (["ArrowDown", "PageDown"].includes(e.key) || (e.key === " " && tag !== "BUTTON" && tag !== "A")) {
        e.preventDefault();
        step(1);
      } else if (["ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        step(-1);
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(slides.length - 1);
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0].clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const dy = touchY - e.changedTouches[0].clientY;
      if (Math.abs(dy) > 50 && !lockRef.current) step(Math.sign(dy));
    };
    const onResize = () => {
      if (rootRef.current) rootRef.current.scrollTop = activeRef.current * window.innerHeight;
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", onResize);
    };
  }, [enabled, go, slides.length]);

  // Mouse parallax: -1..1 from the centre of the screen, read by [data-float] in globals.css.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--mx", ((e.clientX / window.innerWidth - 0.5) * 2).toFixed(3));
        root.style.setProperty("--my", ((e.clientY / window.innerHeight - 0.5) * 2).toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  const value = useMemo(() => ({ active, enabled, slides, go }), [active, enabled, slides, go]);

  return (
    <DeckContext.Provider value={value}>
      {nav}
      <div ref={rootRef} className={paged ? "relative deck:fixed deck:inset-0 deck:overflow-hidden" : "relative"}>
        <div ref={trackRef}>
          {children}
        </div>
      </div>
    </DeckContext.Provider>
  );
}
