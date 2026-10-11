"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import Logo from "@/components/layout/Logo";
import { useDeck } from "./Deck";

const pad = (n: number) => String(n).padStart(2, "0");

/** Minimal chrome: logo and sign in on top, slide counter, and a dot rail on the right. Turns white on dark slides. */
export default function DeckNav() {
  const { active, enabled, slides, go } = useDeck();
  const onDark = enabled && Boolean(slides[active]?.dark);

  return (
    <div className={cn("pointer-events-none fixed inset-0 z-50", onDark && "dark")}>
      <header className="pointer-events-auto absolute inset-x-0 top-0 flex items-center justify-between px-6 py-5 md:px-10 lg:px-16">
        <Logo />
        <div className="flex items-center gap-5">
          {enabled && (
            <span className="hidden font-aeonik-mono text-xs tracking-wider text-text-primary/60 transition-colors dark:text-white/60 md:block">
              {pad(active + 1)} <span className="text-text-primary/30 dark:text-white/30">/ {pad(slides.length)}</span>
            </span>
          )}
          <Link
            href="/login"
            className="rounded-md bg-btn-primary px-4 py-2 font-aeonik-mono text-xs uppercase tracking-wider text-white transition-colors hover:bg-accent dark:bg-white dark:text-text-primary dark:hover:bg-accent dark:hover:text-white"
          >
            Sign in
          </Link>
        </div>
      </header>

      {enabled && (
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
      )}

      {enabled && (
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-transparent">
          <div
            className="h-full origin-left bg-accent transition-transform duration-700 ease-out"
            style={{ transform: "scaleX(" + (active + 1) / slides.length + ")" }}
          />
        </div>
      )}
    </div>
  );
}
