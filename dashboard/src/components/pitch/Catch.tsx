"use client";

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CATCHES } from "@/lib/pitch";
import Reveal from "./Reveal";
import SectionLabel from "./SectionLabel";

type Item = (typeof CATCHES)[number];

/** One card. It tilts toward the cursor, and its example flips from before to after while hovered. */
function TiltCard({ item, index }: { item: Item; index: number }) {
  const [hover, setHover] = useState(false);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [8, -8]), { stiffness: 200, damping: 18 });
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-10, 10]), { stiffness: 200, damping: 18 });

  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const leave = () => {
    px.set(0);
    py.set(0);
    setHover(false);
  };

  return (
    <motion.button
      type="button"
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={onMove}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={leave}
      onFocus={() => setHover(true)}
      onBlur={leave}
      className="group relative h-full w-full overflow-hidden rounded-xl border border-box-outline bg-section p-5 text-left transition-colors hover:border-text-primary"
    >
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5 origin-left bg-accent transition-transform duration-300", hover ? "scale-x-100" : "scale-x-0")} />
      <div className="flex items-center justify-between font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/45">
        <span>{item.family}</span>
        <span>0{index + 1}</span>
      </div>
      <h3 className="mt-3 font-aeonik text-2xl tracking-tight short:text-xl">{item.title}</h3>
      <p className="mt-1.5 font-aeonik-light text-sm leading-relaxed text-text-primary/65">{item.text}</p>
      <div className="relative mt-5 h-10 overflow-hidden rounded-md border border-box-outline bg-inset font-aeonik-mono text-xs">
        <span className={cn("absolute inset-0 flex items-center px-3 transition-all duration-300", hover ? "-translate-y-full opacity-0" : "opacity-100")}>
          <span className="mr-2 text-text-primary/40">before</span>
          {item.before}
        </span>
        <span className={cn("absolute inset-0 flex items-center px-3 text-accent transition-all duration-300", hover ? "opacity-100" : "translate-y-full opacity-0")}>
          <span className="mr-2 text-accent/60">after</span>
          {item.after}
        </span>
      </div>
    </motion.button>
  );
}

/** Slide 4: six kinds of silent change. */
export default function Catch() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col justify-center px-6 py-24 md:px-10 lg:px-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Reveal depth={0.6}>
            <SectionLabel n="2" label="What we catch" />
          </Reveal>
          <Reveal depth={1}>
            <h2 className="mt-6 font-aeonik text-4xl leading-[0.98] tracking-tight md:text-6xl short:md:text-5xl">Six kinds of silent change.</h2>
          </Reveal>
        </div>
        <Reveal depth={1.2}>
          <p className="max-w-xs font-aeonik-light text-base text-text-primary/70">Shape, behaviour and meaning. Most tools stop at shape. Hover a card.</p>
        </Reveal>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3 short:mt-8">
        {CATCHES.map((c, i) => (
          <Reveal key={c.title} depth={1.4 + (i % 3) * 0.35 + Math.floor(i / 3) * 0.3}>
            <TiltCard item={c} index={i} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
