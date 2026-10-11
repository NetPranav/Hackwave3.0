"use client";

import { prHref } from "@/lib/links";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/dashboard/Card";
import ShapeDiff from "@/components/dashboard/ShapeDiff";
import type { TimelineDriftEvent } from "@/lib/mock/timeline";
import { LifecycleLabel, SeverityLabel } from "./EventStatus";

const QUIET_BUTTON =
  "inline-flex items-center gap-1 rounded border border-box-outline px-2.5 py-1 font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/70 transition-colors hover:border-text-primary hover:text-text-primary dark:border-dark-border dark:text-white/70 dark:hover:text-white";

function EventHeader({ event }: { event: TimelineDriftEvent }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-box-outline/40 pb-3 dark:border-dark-border/40">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="font-aeonik text-sm font-semibold tracking-tight text-text-primary dark:text-white">
          {event.service}
        </span>
        <span className="rounded border border-box-outline/50 bg-dash-bg/80 px-2 py-0.5 font-aeonik-mono text-xs text-text-primary/70 dark:border-dark-border/50 dark:bg-white/[0.04] dark:text-white/70">
          <span className="mr-1.5 font-semibold text-ok dark:text-ok-bright">{event.method}</span>
          {event.endpoint}
        </span>
        <span title={"Detector " + event.detectorId} className="font-aeonik-mono text-[10px] text-text-primary/50 dark:text-white/45">
          {event.detectorName} · {event.confidence}% sure
        </span>
      </div>

      <div className="flex items-center gap-3 font-aeonik-mono text-xs">
        <span className="text-text-primary/50 dark:text-white/45">{event.relativeTime}</span>
        <SeverityLabel severity={event.severity} />
        <LifecycleLabel state={event.state} />
      </div>
    </div>
  );
}

interface DriftEventCardProps {
  event: TimelineDriftEvent;
  expanded: boolean;
  onToggleDiff: () => void;
}

function EventFooter({ event, expanded, onToggleDiff }: DriftEventCardProps) {
  const prUrl = prHref(event.fixPrNumber, event.prUrl);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-box-outline/30 pt-3 font-aeonik-mono text-xs dark:border-dark-border/30">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-text-primary/50 dark:text-white/45">AFFECTS</span>
        {event.impactedWorkflows.length > 0 ? (
          event.impactedWorkflows.map((wf) => (
            <span
              key={wf}
              className="rounded border border-box-outline/40 bg-dash-bg/80 px-2 py-0.5 text-[11px] text-text-primary/70 dark:border-dark-border/40 dark:bg-white/[0.04] dark:text-white/70"
            >
              {wf}
            </span>
          ))
        ) : (
          <span className="text-[11px] text-text-primary/40 dark:text-white/40">Nothing in your code is affected</span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {event.diffSnippet && (
          <button type="button" onClick={onToggleDiff} aria-expanded={expanded} className={QUIET_BUTTON}>
            Diff
            <span aria-hidden className={cn("text-[9px] transition-transform", expanded && "rotate-180")}>
              ▼
            </span>
          </button>
        )}
        <Link href={"/app/graph?highlight=" + event.serviceSlug} className={QUIET_BUTTON}>
          Graph ↗
        </Link>
        <Link href={"/app/drift/" + event.id} className={QUIET_BUTTON}>
          Details ↗
        </Link>
{event.healedHits !== undefined && (
          <span className="inline-flex items-center gap-1 rounded border border-accent/60 px-2 py-0.5 font-aeonik-mono text-[10px] uppercase tracking-wider text-accent">
            Healed live · {event.healedHits} response{event.healedHits === 1 ? "" : "s"}
          </span>
        )}
        {event.fixPrNumber && (
          <a
            href={prUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded border border-btn-primary bg-btn-primary px-2.5 py-1 font-aeonik-mono text-xs uppercase tracking-wider text-white transition-colors hover:border-accent hover:bg-accent dark:border-dark-btn-primary dark:bg-dark-btn-primary"
          >
            PR #{event.fixPrNumber} ↗
          </a>
        )}
      </div>
    </div>
  );
}

/** One drift event: who, what, how sure, what it touches, and the next click. */
export default function DriftEventCard(props: DriftEventCardProps) {
  const { event, expanded } = props;
  return (
    <Card as="article" className="p-4 transition-colors hover:bg-dash-bg/25 dark:hover:bg-white/[0.02] sm:p-5">
      <EventHeader event={event} />

      <h3 className="mt-3 font-aeonik text-sm font-medium text-text-primary dark:text-white">{event.title}</h3>
      <p className="mt-1 max-w-3xl font-aeonik-light text-xs leading-relaxed text-text-primary/75 dark:text-white/75">
        {event.description}
      </p>

      <AnimatePresence initial={false}>
        {expanded && event.diffSnippet && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <ShapeDiff className="mt-3" before={event.diffSnippet.before} after={event.diffSnippet.after} />
          </motion.div>
        )}
      </AnimatePresence>

      <EventFooter {...props} />
    </Card>
  );
}
