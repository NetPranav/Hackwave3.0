// What-if simulation. Deterministic: it reads the code map and the existing alias rules, nothing else. No AI.

import { sitesFor, type CodeSite } from "@/lib/mock/codemap";
import { FIX_RULES } from "@/lib/mock/fixes";
import type { ReviewSuggestion } from "@/lib/mock/review";
import type { EndpointStatus } from "@/lib/mock/status";

export type ChangeKind = "rename" | "scale" | "enum" | "cap";
export type FieldClass = "money" | "branching" | "persistence" | "plain";
export type SimSeverity = "breaking" | "suspected" | "info";

export const CHANGE_LABEL: Record<ChangeKind, string> = {
  rename: "RENAME A FIELD",
  scale: "CHANGE THE UNITS",
  enum: "ADD A NEW OPTION",
  cap: "LOWER A LIMIT",
};

/** What the extra input means for each kind of change. */
export const VALUE_META: Record<ChangeKind, { label: string; placeholder: string; fallback: string }> = {
  rename: { label: "New name", placeholder: "display_name", fallback: "" },
  scale: { label: "Numbers are now multiplied by", placeholder: "100", fallback: "100" },
  enum: { label: "New value", placeholder: "partially_shipped", fallback: "new_value" },
  cap: { label: "Server now stops at", placeholder: "100", fallback: "100" },
};

export function defaultValue(kind: ChangeKind, field: string): string {
  return kind === "rename" ? field + "_v2" : VALUE_META[kind].fallback;
}

export interface SimInput {
  serviceSlug: string;
  serviceName: string;
  endpoint: EndpointStatus;
  field: string;
  kind: ChangeKind;
  value: string;
}

export interface SimResult {
  severity: SimSeverity;
  fieldClass: FieldClass;
  automatic: boolean;
  ladder: string;
  verdict: string;
  sites: CodeSite[];
  workflows: string[];
  coverage: { covered: boolean; text: string };
  suggestion: ReviewSuggestion;
}

const MONEY = /amount|price|total|fee|cents|balance|currency|tax/i;

function classify(input: SimInput, sites: CodeSite[]): FieldClass {
  const field = input.endpoint.fields.find((f) => f.path === input.field);
  if (MONEY.test(input.field)) return "money";
  if (input.kind === "enum" || field?.baselineType.startsWith("enum")) return "branching";
  if (sites.some((s) => s.usageKind === "persistence")) return "persistence";
  return "plain";
}

function coverageOf(input: SimInput): SimResult["coverage"] {
  if (input.kind !== "rename") {
    return { covered: false, text: "A safe fix only adds a missing field, so it cannot handle this kind of change. A person has to decide." };
  }
  const rule = FIX_RULES.find(
    (f) =>
      f.serviceSlug === input.serviceSlug &&
      f.endpoint === input.endpoint.path &&
      f.targetField === input.field &&
      f.sourceField === input.value
  );
  return rule
    ? {
        covered: true,
        text: "Already fixed by rule " + rule.ruleId + (rule.fixPrNumber ? " (PR #" + rule.fixPrNumber + ")" : "") + ". Both the old and the new shape keep working.",
      }
    : { covered: false, text: "No fix exists for this rename yet." };
}

function suggestionFor(input: SimInput, automatic: boolean, fieldClass: FieldClass): ReviewSuggestion {
  const route = input.endpoint.method + " " + input.endpoint.path;
  const n = Number(input.value) || 1;
  switch (input.kind) {
    case "rename":
      return automatic
        ? {
            kind: "alias",
            summary: "Add a safe fix so the old name keeps working",
            rule: JSON.stringify({ kind: "alias", endpoint: route, path: "$", target: input.field, source: input.value }),
            note: "Seismo opens a pull request that changes one small file. You merge it.",
          }
        : {
            kind: "behaviour",
            summary: "Review the rename before any change",
            rule: JSON.stringify({ kind: "behaviour", endpoint: route, path: "$." + input.field, renamed_to: input.value }),
            note: "This involves " + (fieldClass === "money" ? "money" : fieldClass === "branching" ? "logic in your code" : "saved data") + ", so even a plain rename goes to a person first.",
          };
    case "scale":
      return {
        kind: "transform",
        summary: "Convert the values back where the app uses them",
        rule: JSON.stringify({ kind: "transform", endpoint: route, path: "$." + input.field, op: n >= 1 ? "divide" : "multiply", by: n >= 1 ? n : 1 / n }),
        note: "Value conversions are never applied automatically. Check every place first.",
      };
    case "enum":
      return {
        kind: "behaviour",
        summary: "Decide how the code treats the new value",
        rule: JSON.stringify({ kind: "behaviour", endpoint: route, path: "$." + input.field, add_case: input.value }),
        note: "A person decides what each screen shows for it.",
      };
    case "cap":
      return {
        kind: "behaviour",
        summary: "Ask for more pages until a short page comes back",
        rule: JSON.stringify({ kind: "behaviour", endpoint: route, param: input.field, observed_max: n, action: "paginate" }),
        note: "This changes how records are fetched and saved, so review it first.",
      };
  }
}

export function simulate(input: SimInput): SimResult {
  const sites = sitesFor(input.serviceSlug, input.field);
  const workflows = [...new Set(sites.map((s) => s.workflow))];
  const fieldClass = classify(input, sites);

  const automatic = input.kind === "rename" && fieldClass === "plain" && sites.length > 0;
  const severity: SimSeverity = sites.length === 0 ? "info" : input.kind === "enum" ? "suspected" : "breaking";

  const ladder = automatic
    ? "Automatic fix: Seismo opens a PR, you merge it"
    : input.kind === "scale"
      ? "Needs a person: convert the values"
      : "Needs a person: change the code";

  const verdict =
    sites.length === 0
      ? "Nothing in your code uses " + input.field + ", so this change breaks nothing. It would only be noted as info."
      : sites.length + (sites.length === 1 ? " place in your code" : " places in your code") + ", in " + workflows.length + (workflows.length === 1 ? " feature, use " : " features, use ") + input.field + ".";

  return {
    severity,
    fieldClass,
    automatic,
    ladder,
    verdict,
    sites,
    workflows,
    coverage: coverageOf(input),
    suggestion: suggestionFor(input, automatic, fieldClass),
  };
}
