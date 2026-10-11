"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/dashboard/Card";
import type { EndpointStatus, FieldComparison } from "@/lib/mock/status";
import { plainType } from "@/lib/plain";
import { DOT_CLASS, STATE_META } from "./StateLabel";

type FieldTone = "accent" | "warn" | "info" | "match";

const FIELD_STATUS: Record<FieldComparison["status"], { label: string; tone: FieldTone }> = {
  missing_renamed: { label: "RENAMED", tone: "accent" },
  limit_capped: { label: "LIMITED", tone: "accent" },
  unit_drift: { label: "UNIT CHANGED", tone: "warn" },
  type_changed: { label: "TYPE CHANGED", tone: "warn" },
  removed: { label: "REMOVED", tone: "accent" },
  new_field: { label: "NEW FIELD", tone: "info" },
  enum_expanded: { label: "NEW OPTION", tone: "info" },
  match: { label: "SAME", tone: "match" },
};

const ROW_TINT: Record<FieldTone, string> = {
  accent: "bg-accent/[0.04]",
  warn: "bg-warn/[0.05] dark:bg-warn-bright/[0.06]",
  info: "",
  match: "",
};

const ROW_EDGE: Record<FieldTone, string> = {
  accent: "border-l-accent",
  warn: "border-l-warn dark:border-l-warn-bright",
  info: "border-l-text-primary/30 dark:border-l-white/30",
  match: "border-l-transparent",
};

const STATUS_TEXT: Record<FieldTone, string> = {
  accent: "text-accent",
  warn: "text-warn dark:text-warn-bright",
  info: "text-text-primary dark:text-white",
  match: "text-text-primary/40 dark:text-white/40",
};

const TH = "px-3 py-2.5 font-medium first:pl-5 last:pr-5";
const TD = "px-3 py-3 align-top first:pl-5 last:pr-5";
const MONO_CELL = "whitespace-nowrap font-aeonik-mono text-xs";
const MUTED = "text-text-primary/50 dark:text-white/45";

interface EndpointFieldsProps {
  endpoints: EndpointStatus[];
  index: number;
  onIndexChange: (i: number) => void;
}

function EndpointTabs({ endpoints, index, onIndexChange }: EndpointFieldsProps) {
  return (
    <div
      role="tablist"
      aria-label="API calls"
      className="flex gap-1 overflow-x-auto border-b border-box-outline px-3 pt-2 dark:border-dark-border"
    >
      {endpoints.map((ep, i) => {
        const active = i === index;
        const tone = STATE_META[ep.state].tone;
        return (
          <button
            key={ep.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onIndexChange(i)}
            className={cn(
              "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 font-aeonik-mono text-xs transition-colors",
              active
                ? "border-text-primary font-semibold text-text-primary dark:border-white dark:text-white"
                : "border-transparent text-text-primary/60 hover:text-text-primary dark:text-white/50 dark:hover:text-white"
            )}
          >
            <span className="text-[10px] font-semibold text-ok dark:text-ok-bright">{ep.method}</span>
            <span>{ep.path}</span>
            {tone !== "muted" && <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASS[tone])} />}
            <span className="text-[10px] text-text-primary/40 dark:text-white/40">{ep.callsPerMin} req/m</span>
          </button>
        );
      })}
    </div>
  );
}

function FieldRow({ field }: { field: FieldComparison }) {
  const { label, tone } = FIELD_STATUS[field.status];
  const isMatch = tone === "match";
  const sameShape = field.baselineType === field.observedType;
  const samePresence = field.baselinePresence === field.observedPresence;

  return (
    <tr className={ROW_TINT[tone]}>
      <td className={cn(TD, "border-l-2", ROW_EDGE[tone])}>
        <span
          className={cn(
            "font-aeonik-mono text-xs font-medium",
            isMatch ? "text-text-primary/60 dark:text-white/60" : "text-text-primary dark:text-white"
          )}
        >
          {field.path}
        </span>
        {field.note && (
          <p className="mt-1 max-w-md font-aeonik-light text-[11px] leading-relaxed text-text-primary/60 dark:text-white/60">
            {field.note}
          </p>
        )}
        {field.enumValues && (
          <p className="mt-1 font-aeonik-mono text-[10px] text-text-primary/50 dark:text-white/45">
            {field.enumValues.join(" · ")}
          </p>
        )}
      </td>
      <td className={cn(TD, MONO_CELL)}>
        {sameShape ? (
          <span className={MUTED}>{plainType(field.observedType)}</span>
        ) : (
          <>
            <span className={MUTED}>{plainType(field.baselineType)}</span>
            <span className="mx-1.5 text-text-primary/30 dark:text-white/30">→</span>
            <span className="font-medium text-text-primary dark:text-white">{plainType(field.observedType)}</span>
          </>
        )}
      </td>
      <td className={cn(TD, MONO_CELL)}>
        <span className={samePresence ? MUTED : "font-medium text-text-primary dark:text-white"}>
          {samePresence ? field.observedPresence : `${field.baselinePresence} → ${field.observedPresence}`}
        </span>
      </td>
      <td className={cn(TD, MONO_CELL, "text-text-primary/60 dark:text-white/60")}>{field.p50Magnitude}</td>
      <td className={cn(TD, "whitespace-nowrap text-right")}>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 font-aeonik-mono text-[11px] font-medium uppercase tracking-wider",
            STATUS_TEXT[tone]
          )}
        >
          {tone === "accent" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
          {isMatch && <span aria-hidden>✓</span>}
          {label}
        </span>
      </td>
    </tr>
  );
}

/** Endpoint tabs plus the baseline-vs-now field table. Changed fields sort first and carry the colour; matches fade back. */
export default function EndpointFields({ endpoints, index, onIndexChange }: EndpointFieldsProps) {
  const endpoint = endpoints[index] ?? endpoints[0];
  if (!endpoint) return null;
  const isMatch = (f: FieldComparison) => FIELD_STATUS[f.status].tone === "match";
  const fields = [...endpoint.fields].sort((a, b) => Number(isMatch(a)) - Number(isMatch(b)));
  const changed = fields.filter((f) => !isMatch(f)).length;

  return (
    <Card>
      <EndpointTabs endpoints={endpoints} index={index} onIndexChange={onIndexChange} />

      <p className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 font-aeonik-mono text-[11px] text-text-primary/50 dark:text-white/45">
        <span>
          {changed === 0 ? "No changes: every field looks normal" : `${changed} of ${fields.length} fields changed`}
        </span>
        <span>Shapes only: no record values leave your server</span>
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-box-outline bg-dash-bg/60 font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/60 dark:border-dark-border dark:bg-white/[0.02] dark:text-white/55">
              <th className={TH}>Field</th>
              <th className={TH}>Before → now</th>
              <th className={TH} title="How many responses contain this field">Seen in</th>
              <th className={TH} title="The usual size or length of its value">Typical size</th>
              <th className={cn(TH, "text-right")}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-box-outline/40 dark:divide-dark-border/40">
            {fields.map((field) => (
              <FieldRow key={field.path} field={field} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
