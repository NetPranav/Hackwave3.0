"use client";

import { useEffect, useState } from "react";
import { useSlideActive } from "./deck/Slide";

interface CountUpProps {
  value: number;
  duration?: number;
  className?: string;
}

/** Counts from zero to the value each time its slide comes on screen. */
export default function CountUp({ value, duration = 1400, className }: CountUpProps) {
  const active = useSlideActive();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const start = performance.now();
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = (now: number) => {
      const t = instant ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, value, duration]);

  return <span className={className}>{shown.toLocaleString("en-US")}</span>;
}
