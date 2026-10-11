"use client";

import { useState } from "react";
import { samplesFor } from "@/lib/compare/samples";
import { findEndpoint, type EndpointRef } from "@/lib/compare/catalog";
import { defaultValue, simulate, type ChangeKind } from "@/lib/compare/simulate";
import type { FieldComparison } from "@/lib/mock/status";
import ModeBar, { type Mode } from "./ModeBar";
import ComparePanel from "./ComparePanel";
import SimulateForm from "./SimulateForm";
import SimulationResult from "./SimulationResult";

export interface CompareInitial {
  mode?: Mode;
  endpoint?: string;
  kind?: ChangeKind;
  field?: string;
  value?: string;
}

/** The field a kind of change most naturally applies to on this endpoint. */
const WANTED: Record<ChangeKind, FieldComparison["status"]> = {
  rename: "missing_renamed",
  scale: "unit_drift",
  enum: "enum_expanded",
  cap: "limit_capped",
};

function defaultField(target: EndpointRef, kind: ChangeKind): string {
  const fields = target.endpoint.fields;
  return (fields.find((f) => f.status === WANTED[kind]) ?? fields.find((f) => kind === "enum" && f.enumValues) ?? fields[0])?.path ?? "";
}

/** For a rename, the obvious new name is the field that appeared in its place. */
function suggestValue(target: EndpointRef, kind: ChangeKind, field: string): string {
  if (kind === "rename") {
    return target.endpoint.fields.find((f) => f.status === "new_field")?.path ?? defaultValue(kind, field);
  }
  return defaultValue(kind, field);
}

/** Compare an endpoint's baseline to now, or simulate a what-if change. Everything is computed locally and deterministically. */
export default function CompareView({ initial }: { initial: CompareInitial }) {
  const [mode, setMode] = useState<Mode>(initial.mode ?? "compare");
  const [endpointId, setEndpointId] = useState(() => findEndpoint(initial.endpoint).endpoint.id);
  const [kind, setKind] = useState<ChangeKind>(initial.kind ?? "rename");
  const target = findEndpoint(endpointId);

  const [field, setField] = useState(() => {
    const t = findEndpoint(initial.endpoint);
    return initial.field && t.endpoint.fields.some((f) => f.path === initial.field) ? initial.field : defaultField(t, initial.kind ?? "rename");
  });
  const [value, setValue] = useState(() => initial.value ?? suggestValue(findEndpoint(initial.endpoint), initial.kind ?? "rename", field));

  const reset = (t: EndpointRef, k: ChangeKind) => {
    const f = defaultField(t, k);
    setField(f);
    setValue(suggestValue(t, k, f));
  };

  const compared = samplesFor(target.endpoint);
  const result = simulate({
    serviceSlug: target.serviceSlug,
    serviceName: target.serviceName,
    endpoint: target.endpoint,
    field,
    kind,
    value: value.trim() || defaultValue(kind, field),
  });

  const stat =
    mode === "compare"
      ? { value: compared.changedCount, label: compared.changedCount === 1 ? "field changed on this API call" : "fields changed on this API call" }
      : { value: result.sites.length, label: result.sites.length === 1 ? "place in your code would be affected" : "places in your code would be affected" };

  return (
    <main className="mx-auto max-w-[1440px] space-y-6 px-6 py-6 md:px-10 lg:px-16">
      <ModeBar
        mode={mode}
        onModeChange={setMode}
        endpointId={endpointId}
        onEndpointChange={(id) => {
          const t = findEndpoint(id);
          setEndpointId(t.endpoint.id);
          reset(t, kind);
        }}
        stat={stat}
      />

      {mode === "compare" ? (
        <ComparePanel target={target} />
      ) : (
        <>
          <SimulateForm
            target={target}
            kind={kind}
            onKindChange={(k) => {
              setKind(k);
              reset(target, k);
            }}
            field={field}
            onFieldChange={(f) => {
              setField(f);
              setValue(suggestValue(target, kind, f));
            }}
            value={value}
            onValueChange={setValue}
          />
          <SimulationResult target={target} field={field} result={result} />
        </>
      )}
    </main>
  );
}
