"use client";

import { cn } from "@/lib/utils";
import { useDeck } from "./Deck";

/** Only the dot rail on the right. Turns white on dark slides; hover a dot to see the slide name. */
export default function DeckNav() {
  const { active, enabled, slides, go } = useDeck();
  const onDark = enabled && Boolean(slides[active]?.dark);
  if (!enabled) return null;

  return (
    <div className={cn("pointer-events-none fixed inset-0 z-50", onDark && "dark")}>
      <nav aria-label="Slides" className="pointer-events-auto absolute right-5 top-1/2 flex -translate-y-1/2 flex-col items-end gap-2.5">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(i)}
            aria-label={"Go to " + s.label}
            aria-current={i === active ? "step" : undefined}
            className="group flex items-center gap-3 py-0.5"
          >
            <span className="pointer-events-none translate-x-2 whitespace-nowrap font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/70 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 dark:text-white/70">
              {s.label}
            </span>
            <span
              className={cn(
                "block h-1.5 rounded-full transition-all duration-300",
                i === active ? "w-6 bg-accent" : "w-1.5 bg-text-primary/30 group-hover:bg-text-primary/70 dark:bg-white/30 dark:group-hover:bg-white/70"
              )}
            />
          </button>
        ))}
      </nav>
    </div>
  );
}
