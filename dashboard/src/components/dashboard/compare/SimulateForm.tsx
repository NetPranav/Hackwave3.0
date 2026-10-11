"use client";

import RubberSegment, { type RubberSegmentItem } from "@/components/ui/RubberSegment";
import { Card, CardHeader } from "@/components/dashboard/Card";
import { CHANGE_LABEL, VALUE_META, type ChangeKind } from "@/lib/compare/simulate";
import type { EndpointRef } from "@/lib/compare/catalog";
import { SELECT_CLASS } from "./EndpointSelect";

const KIND_ITEMS: RubberSegmentItem[] = (Object.keys(CHANGE_LABEL) as ChangeKind[]).map((value) => ({
  value,
  label: CHANGE_LABEL[value],
}));

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-2 block font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45">
      {children}
    </span>
  );
}

interface SimulateFormProps {
  target: EndpointRef;
  kind: ChangeKind;
  onKindChange: (kind: ChangeKind) => void;
  field: string;
  onFieldChange: (field: string) => void;
  value: string;
  onValueChange: (value: string) => void;
}

/** What if... pick the kind of change, the field it hits and one parameter. Runs as you type. */
export default function SimulateForm({ target, kind, onKindChange, field, onFieldChange, value, onValueChange }: SimulateFormProps) {
  const meta = VALUE_META[kind];
  return (
    <Card>
      <CardHeader title="What if the provider changes…" />
      <div className="space-y-5 p-5 md:p-6">
        <div>
          <RubberSegment
            items={KIND_ITEMS}
            value={kind}
            onChange={(v) => onKindChange(v as ChangeKind)}
            size="sm"
            radius={6}
            inset={2}
            equalSlots={false}
            stretch={50}
            squash={2}
            speed={1}
            trackColor="var(--rs-track-theme)"
            thumbColor="var(--rs-thumb-theme)"
            textColor="var(--rs-ink-theme)"
            activeTextColor="var(--rs-ink-active-theme)"
            className="font-aeonik-mono text-[11px] uppercase tracking-wider"
            aria-label="Kind of change"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="block">
            <Label>{kind === "cap" ? "Setting" : "Field"}</Label>
            <select value={field} onChange={(e) => onFieldChange(e.target.value)} className={SELECT_CLASS}>
              {target.endpoint.fields.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.path}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <Label>{meta.label}</Label>
            <input
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              placeholder={meta.placeholder}
              spellCheck={false}
              autoComplete="off"
              className={SELECT_CLASS + " cursor-text placeholder:text-text-primary/40 dark:placeholder:text-white/30"}
            />
          </label>
        </div>
      </div>
    </Card>
  );
}
