"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { FAQ } from "@/lib/pitch";
import Reveal from "./Reveal";
import SectionLabel from "./SectionLabel";

/** Slide 10: plain questions, one open at a time. */
export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col justify-center px-6 py-24 md:px-10 lg:px-16">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
        <Reveal depth={0.8}>
          <SectionLabel n="8" label="Questions" />
          <h2 className="mt-6 font-aeonik text-4xl leading-[0.98] tracking-tight md:text-5xl">Things people ask first.</h2>
        </Reveal>
        <Reveal depth={1.6}>
          <ul className="border-t border-box-outline">
            {FAQ.map((item, i) => {
              const isOpen = open === i;
              return (
                <li key={item.q} className="border-b border-box-outline">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-6 py-5 text-left short:py-4 transition-colors hover:text-accent"
                  >
                    <span className="font-aeonik text-lg tracking-tight md:text-xl">{item.q}</span>
                    <span aria-hidden className={cn("font-aeonik-mono text-xl transition-transform duration-300", isOpen && "rotate-45")}>+</span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-2xl pb-5 font-aeonik-light text-base leading-relaxed text-text-primary/70">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </div>
  );
}
