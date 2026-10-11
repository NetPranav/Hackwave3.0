"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TIMELINE_EVENTS, type TimelineDriftEvent } from "@/lib/mock/timeline";
import RangeBar, { bucketOf } from "./RangeBar";
import TimelineToolbar from "./TimelineToolbar";
import DriftEventCard from "./DriftEventCard";
import { SeverityNode } from "./EventStatus";
import DeployRow from "./DeployRow";

const PROVIDERS = Array.from(
  new Map(
    TIMELINE_EVENTS.filter((i): i is TimelineDriftEvent => i.type !== "deploy").map((e) => [
      e.serviceSlug,
      { slug: e.serviceSlug, name: e.service },
    ])
  ).values()
);

const ENTER = { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };

/** Timeline: when it happened (range bar), what to look at (toolbar), then the feed. */
export default function TimelineView() {
  const [severity, setSeverity] = useState("all");
  const [service, setService] = useState("all");
  const [query, setQuery] = useState("");
  const [bucket, setBucket] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>("drf_users_name_rename");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TIMELINE_EVENTS.filter((item) => {
      if (bucket !== null && bucketOf(item.timestamp) !== bucket) return false;
      if (item.type === "deploy") return severity === "all" || severity === "info" ? service === "all" && !q : false;
      if (severity !== "all" && item.severity !== severity) return false;
      if (service !== "all" && item.serviceSlug !== service) return false;
      if (!q) return true;
      return [item.title, item.service, item.endpoint, item.detectorId].some((t) => t.toLowerCase().includes(q));
    });
  }, [severity, service, query, bucket]);

  return (
    <main className="mx-auto max-w-[1440px] space-y-6 px-6 py-6 md:px-10 lg:px-16">
      <RangeBar items={TIMELINE_EVENTS} selectedBucket={bucket} onSelectBucket={setBucket} />

      <TimelineToolbar
        severity={severity}
        onSeverityChange={setSeverity}
        service={service}
        onServiceChange={setService}
        services={PROVIDERS}
        query={query}
        onQueryChange={setQuery}
      />

      {visible.length === 0 ? (
        <p className="rounded-md border border-box-outline bg-section px-5 py-12 text-center font-aeonik-light text-sm text-text-primary/60 dark:border-dark-border dark:bg-dark-dash-section dark:text-white/60">
          No events match these filters.
        </p>
      ) : (
        <ol className="relative space-y-3.5">
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-6 left-[11px] top-5 w-px bg-box-outline/70 dark:bg-dark-border/70"
          />
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((item) => (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={ENTER}
                className="relative flex items-start gap-4 sm:gap-5"
              >
                <div className="relative z-10 shrink-0 pt-4">
                  {item.type === "deploy" ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-box-outline bg-section dark:border-dark-border dark:bg-dark-dash-section">
                      <span className="h-1.5 w-1.5 rounded-full bg-text-primary/50 dark:bg-white/50" />
                    </span>
                  ) : (
                    <SeverityNode severity={item.severity} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {item.type === "deploy" ? (
                    <DeployRow deploy={item} />
                  ) : (
                    <DriftEventCard
                      event={item}
                      expanded={expandedId === item.id}
                      onToggleDiff={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    />
                  )}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </main>
  );
}
