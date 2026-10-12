"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Wheel movement that counts as one step, and how long a step locks input so one flick is one step. */
const WHEEL_STEP = 30;
const LOCK_MS = 900;

/** The step in the URL (/deck#7), so a refresh or coming back from the live demo keeps your place. */
const stepFromHash = (total: number) => {
  const n = Number(window.location.hash.slice(1));
  return Number.isInteger(n) && n >= 0 && n < total ? n : 0;
};

/**
 * The presenter controls: arrow keys, Page Up/Down (what a clicker sends), space, mouse wheel and swipe.
 * F toggles fullscreen. `gate(from)` can take over a forward move (the live demo hand-off) by returning true.
 * Returns the current step and a way to jump to one.
 */
export function useSteps(total: number, gate?: (from: number) => boolean) {
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);
  const lockedUntil = useRef(0);
  const wheelSum = useRef(0);

  const go = useCallback(
    (target: number) => {
      const next = Math.max(0, Math.min(total - 1, target));
      if (next === stepRef.current) return;
      stepRef.current = next;
      lockedUntil.current = performance.now() + LOCK_MS;
      window.history.replaceState(null, "", "#" + next);
      setStep(next);
    },
    [total]
  );

  // Start where the URL says (after the first paint, so server and client render the same first frame).
  useEffect(() => {
    const start = stepFromHash(total);
    if (start === 0) return;
    stepRef.current = start;
    const frame = requestAnimationFrame(() => setStep(start));
    return () => cancelAnimationFrame(frame);
  }, [total]);

  useEffect(() => {
    const move = (delta: number) => {
      if (performance.now() < lockedUntil.current) return;
      if (delta > 0 && gate?.(stepRef.current)) return;
      go(stepRef.current + delta);
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        move(1);
      } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault();
        move(-1);
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(total - 1);
      else if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelSum.current += e.deltaY;
      if (Math.abs(wheelSum.current) >= WHEEL_STEP) {
        move(Math.sign(wheelSum.current));
        wheelSum.current = 0;
      }
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => (touchY = e.touches[0].clientY);
    const onTouchEnd = (e: TouchEvent) => {
      const dy = touchY - e.changedTouches[0].clientY;
      if (Math.abs(dy) > 50) move(Math.sign(dy));
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [go, gate, total]);

  return { step, go };
}
