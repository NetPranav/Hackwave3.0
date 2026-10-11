import { daysUntil, type RadarItem, type RadarKind, type RadarSeverity } from "@/lib/mock/radar";
import type { EventSeverity } from "@/lib/mock/timeline";

/** The runway shows this many days ahead of today. */
export const RUNWAY_DAYS = 60;

export const KIND_LABEL: Record<RadarKind, string> = {
  sunset: "Switch-off date",
  deprecation: "Deprecated",
  changelog: "Announced",
  breaking: "Breaking notice",
  spec: "Spec change",
};

export const EXTRACTOR_LABEL: Record<RadarItem["extractedBy"], string> = {
  ai: "READ BY AI",
  rules: "READ BY RULES",
  header: "FROM A HEADER",
  spec: "FROM THE API SPEC",
};

/** The radar uses info / warning / breaking; the shared severity label uses suspected for the middle step. */
export const TO_EVENT_SEVERITY: Record<RadarSeverity, EventSeverity> = {
  info: "info",
  warning: "suspected",
  breaking: "breaking",
};

export const DOT: Record<RadarSeverity, string> = {
  breaking: "bg-accent",
  warning: "bg-warn dark:bg-warn-bright",
  info: "bg-text-primary/40 dark:bg-white/40",
};

export type RadarFilter = "all" | "code" | "info";

export const FILTERS: { value: RadarFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "code", label: "Hits your code" },
  { value: "info", label: "Good to know" },
];

export function matchesFilter(item: RadarItem, filter: RadarFilter): boolean {
  if (filter === "code") return item.matchedFiles.length > 0;
  if (filter === "info") return item.matchedFiles.length === 0;
  return true;
}

/** True when the change has started: past its date, or already seen in traffic. */
export function isLive(item: RadarItem): boolean {
  const days = daysUntil(item);
  return Boolean(item.driftEventId) || (days !== undefined && days < 0);
}

/** In 14 days, tomorrow, today, 2 days ago. */
export function whenLabel(item: RadarItem): string {
  const days = daysUntil(item);
  if (item.driftEventId) return "Seen in traffic";
  if (days === undefined) return "No date yet";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return "In " + days + " days";
  return Math.abs(days) + (days === -1 ? " day ago" : " days ago");
}

/** 25 OCT. Empty when the provider gave no date. */
export function shortDate(item: RadarItem): string {
  if (!item.date) return "";
  const d = new Date(item.date + "T00:00:00Z");
  return String(d.getUTCDate()).padStart(2, "0") + " " + d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
}

/** The Compare and Simulate link, pre-filled. Undefined when this change has no matching what-if. */
export function simulateHref(item: RadarItem): string | undefined {
  const s = item.simulation;
  if (!s) return undefined;
  const qs = new URLSearchParams({ mode: "simulate", endpoint: s.endpoint, change: s.change, field: s.field, value: s.value });
  return "/app/compare?" + qs.toString();
}
