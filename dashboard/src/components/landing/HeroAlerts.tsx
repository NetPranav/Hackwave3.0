"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

const ALERTS = [
  { tone: "breaking", api: "Payments API", what: "customer_id is now customerId", impact: "Checkout at risk" },
  { tone: "suspected", api: "Orders API", what: "limit 500 now returns 100", impact: "Order list incomplete" },
  { tone: "fixed", api: "Payments API", what: "PR #7 · one alias rule", impact: "8 of 8 safety checks passed" },
] as const;

const TONE = {
  breaking: { dot: "bg-accent", label: "BREAKING", text: "text-accent" },
  suspected: { dot: "bg-warn", label: "SUSPECTED", text: "text-warn" },
  fixed: { dot: "bg-ok", label: "FIX READY", text: "text-ok" },
};

/** A small stack of live-looking alerts that cycles every few seconds. Sample data. */
export default function HeroAlerts() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => (n + 1) % ALERTS.length), 3200);
    return () => window.clearInterval(t);
  }, []);
  const a = ALERTS[i];
  const tone = TONE[a.tone];

  return (
    <div className="w-[340px] rounded-xl border border-box-outline bg-section/90 p-1.5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <div className="flex items-center justify-between px-3 py-2 font-aeonik-mono text-[10px] uppercase tracking-[0.2em] text-text-primary/45">
        <span>Seismo · live</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" />
          watching 6 APIs
        </span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-lg border border-box-outline bg-section p-4"
        >
          <p className={cn("flex items-center gap-2 font-aeonik-mono text-[11px] font-medium tracking-wider", tone.text)}>
            <span className={cn("h-2 w-2 rounded-full", tone.dot, a.tone === "breaking" && "animate-pulse")} />
            {tone.label}
            <span className="font-normal text-text-primary/40">· {a.api}</span>
          </p>
          <p className="mt-2.5 font-aeonik text-lg leading-snug tracking-tight">{a.what}</p>
          <p className="mt-1 font-aeonik-light text-sm text-text-primary/60">{a.impact}</p>
        </motion.div>
      </AnimatePresence>
      <div className="flex gap-1 px-3 py-2.5">
        {ALERTS.map((_, n) => (
          <span key={n} className={cn("h-0.5 flex-1 rounded-full transition-colors duration-500", n === i ? "bg-text-primary" : "bg-box-outline")} />
        ))}
      </div>
    </div>
  );
}
