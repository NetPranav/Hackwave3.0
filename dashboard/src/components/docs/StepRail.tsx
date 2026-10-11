"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface Step {
  id: string;
  label: string;
}

/** Sticky list of the steps. The one in view is marked, so people always know where they are. */
export default function StepRail({ steps }: { steps: Step[] }) {
  const [active, setActive] = useState(steps[0]?.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" }
    );
    for (const s of steps) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [steps]);

  return (
    <nav aria-label="Steps" className="sticky top-24">
      <p className="font-aeonik-mono text-[10px] uppercase tracking-[0.2em] text-text-primary/50">On this page</p>
      <ol className="mt-4 space-y-1 border-l border-box-outline">
        {steps.map((s, i) => (
          <li key={s.id}>
            <a
              href={"#" + s.id}
              className={cn(
                "-ml-px block border-l-2 py-1.5 pl-4 font-aeonik-mono text-xs uppercase tracking-wider transition-colors",
                active === s.id
                  ? "border-accent text-text-primary"
                  : "border-transparent text-text-primary/50 hover:text-text-primary"
              )}
            >
              <span className={cn("mr-2", active === s.id ? "text-accent" : "text-text-primary/35")}>{"0" + (i + 1)}</span>
              {s.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
