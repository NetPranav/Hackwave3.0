// Synthetic samples for Compare: shape tokens built from fingerprints, never real values.

import type { EndpointStatus } from "@/lib/mock/status";

type Side = "baseline" | "observed";

/** "string (uuid)" becomes "<string · uuid>", an enum becomes "<enum: a|b|c>", an absent field becomes null. */
function sampleOf(type: string, enumValues: string[] | undefined, side: Side): string | null {
  if (type.startsWith("—")) return null;
  const base = type.split(" ")[0];
  const detail = /\((.*)\)/.exec(type)?.[1];
  if (base === "enum") {
    const values = (enumValues ?? [])
      .filter((v) => side === "observed" || !v.startsWith("+"))
      .map((v) => v.replace(/^\+/, ""));
    return "<one of: " + (values.length ? values.join("|") : (detail ?? "?")) + ">";
  }
  return "<" + base + (detail ? " · " + detail : "") + ">";
}

export interface EndpointSamples {
  baseline: Record<string, string>;
  observed: Record<string, string>;
  changedCount: number;
}

/** Baseline and current shape of one endpoint, as two key/value maps ready for a side-by-side diff. */
export function samplesFor(endpoint: EndpointStatus): EndpointSamples {
  const baseline: Record<string, string> = {};
  const observed: Record<string, string> = {};

  for (const f of endpoint.fields) {
    const before = f.baselinePresence === "0%" ? null : sampleOf(f.baselineType, f.enumValues, "baseline");
    const after = f.observedPresence === "0%" ? null : sampleOf(f.observedType, f.enumValues, "observed");
    if (before !== null) baseline[f.path] = before;
    if (after !== null) observed[f.path] = after;
  }

  const keys = new Set([...Object.keys(baseline), ...Object.keys(observed)]);
  let changedCount = 0;
  for (const k of keys) if (baseline[k] !== observed[k]) changedCount += 1;

  return { baseline, observed, changedCount };
}
