"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { RadarItem } from "@/lib/mock/radar";
import { DOT, EXTRACTOR_LABEL, KIND_LABEL, isLive, shortDate, simulateHref, whenLabel } from "./radarMeta";

const LABEL = "font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45";
const NOTE = "ml-2 normal-case tracking-normal text-text-primary/35 dark:text-white/30";
const BODY = "mt-2 font-aeonik-light text-sm leading-relaxed text-text-primary/80 dark:text-white/80";
const PRIMARY =
  "inline-flex items-center gap-1 rounded bg-btn-primary px-3 py-1.5 font-aeonik-mono text-xs uppercase tracking-wider text-white transition-opacity hover:opacity-90 dark:bg-dark-btn-primary";
const QUIET =
  "inline-flex items-center gap-1 rounded border border-box-outline px-3 py-1.5 font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/70 transition-colors hover:border-text-primary hover:text-text-primary dark:border-dark-border dark:text-white/70 dark:hover:text-white";

function Details({ item }: { item: RadarItem }) {
  const sim = simulateHref(item);
  return (
    <div className="space-y-5 pb-6 pl-5 pr-5 pt-1 md:pl-[8.5rem] md:pr-8">
      {item.quote && (
        <blockquote className="border-l-2 border-accent/60 pl-3">
          <p className="font-aeonik-light text-sm italic leading-relaxed text-text-primary/80 dark:text-white/80">{item.quote}</p>
          <p className="mt-1 font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/45 dark:text-white/40">
            {KIND_LABEL[item.kind]} · {item.source} · word for word
          </p>
        </blockquote>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={LABEL}>Hits</span>
        {item.matchedFiles.length > 0 ? (
          item.matchedFiles.map((file) => (
            <span
              key={file}
              className="rounded border border-box-outline/50 bg-dash-bg/80 px-2 py-0.5 font-aeonik-mono text-[11px] text-text-primary/70 dark:border-dark-border/50 dark:bg-white/[0.04] dark:text-white/70"
            >
              {file}
            </span>
          ))
        ) : (
          <span className="font-aeonik-mono text-[11px] text-text-primary/40 dark:text-white/40">Nothing in your code</span>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <section>
          <h4 className={LABEL}>
            Why it matters <span className={NOTE}>{EXTRACTOR_LABEL[item.extractedBy]}</span>
          </h4>
          <p className={BODY}>{item.explanation}</p>
        </section>
        <section>
          <h4 className={LABEL}>
            What to do <span className={NOTE}>FIXED TEMPLATE, NO AI</span>
          </h4>
          <p className={BODY}>{item.suggestion}</p>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {item.driftEventId && (
          <Link href={"/app/drift/" + item.driftEventId} className={PRIMARY}>
            See the change <span aria-hidden>→</span>
          </Link>
        )}
        {sim && (
          <Link href={sim} className={item.driftEventId ? QUIET : PRIMARY}>
            Simulate this <span aria-hidden>→</span>
          </Link>
        )}
        {item.sourceUrl && (
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className={QUIET}>
            Source ↗
          </a>
        )}
      </div>
    </div>
  );
}

interface RadarRowProps {
  item: RadarItem;
  open: boolean;
  onToggle: () => void;
}

/** One line per change. Click to see the quote, the code it hits and what to do. */
export default function RadarRow({ item, open, onToggle }: RadarRowProps) {
  const hits = item.matchedFiles.length;
  return (
    <li id={"radar-" + item.id}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-4 text-left transition-colors hover:bg-dash-bg/50 dark:hover:bg-white/[0.02] md:grid-cols-[6.5rem_auto_1fr_auto_auto] md:px-8"
      >
        <span className="hidden md:block">
          <span className="block font-aeonik-mono text-sm text-text-primary dark:text-white">{shortDate(item) || "--"}</span>
          <span className={cn("block font-aeonik-mono text-[10px] uppercase tracking-wider", isLive(item) ? "text-accent" : "text-text-primary/45 dark:text-white/40")}>
            {whenLabel(item)}
          </span>
        </span>
        <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", DOT[item.severity])} />
        <span className="min-w-0">
          <span className="block truncate font-aeonik text-base font-medium tracking-tight text-text-primary dark:text-white">{item.title}</span>
          <span className="block truncate font-aeonik-mono text-[11px] text-text-primary/50 dark:text-white/45">
            {item.service}
            {item.endpoint ? " · " + item.endpoint : ""}
            <span className="md:hidden"> · {whenLabel(item)}</span>
          </span>
        </span>
        <span
          className={cn(
            "hidden whitespace-nowrap font-aeonik-mono text-[11px] md:block",
            hits > 0 ? "text-text-primary dark:text-white" : "text-text-primary/40 dark:text-white/40"
          )}
        >
          {hits > 0 ? hits + (hits === 1 ? " place in your code" : " places in your code") : "No code affected"}
        </span>
        <span aria-hidden className={cn("text-[10px] text-text-primary/40 transition-transform dark:text-white/40", open && "rotate-180")}>
          ▼
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <Details item={item} />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
