"use client";

import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { useDeck } from "./Deck";

const SlideIndex = createContext(0);

/** True while this slide is on screen. When the deck is off (phones), every slide counts as on screen. */
export function useSlideActive() {
  const { active, enabled } = useDeck();
  const index = useContext(SlideIndex);
  return !enabled || active === index;
}

interface SlideProps {
  index: number;
  id: string;
  label: string;
  dark?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** One full-screen slide. Dark slides use the near-black band from the references. */
export default function Slide({ index, id, label, dark, className, children }: SlideProps) {
  return (
    <SlideIndex.Provider value={index}>
      <section
        id={id}
        aria-label={label}
        className={cn(
          "relative isolate flex min-h-svh w-full flex-col overflow-hidden deck:h-screen deck:min-h-0",
          dark ? "bg-btn-primary text-white" : "bg-page-bg",
          className
        )}
      >
        {children}
      </section>
    </SlideIndex.Provider>
  );
}
