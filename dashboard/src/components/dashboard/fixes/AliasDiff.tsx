"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/dashboard/Card";
import { useCopy } from "@/hooks/useCopy";
import type { FixRuleData } from "@/lib/mock/fixes";

type DiffMode = "unified" | "split";

interface DiffLine {
  kind: "context" | "add";
  text: string;
}

/** The new rule as added lines inside the existing array, so the diff reads like a real PR. */
function buildLines(fix: FixRuleData): DiffLine[] {
  const body = [
    `"id": "${fix.ruleId}",`,
    `"kind": "alias",`,
    `"endpoint": "${fix.method} ${fix.endpoint}",`,
    `"path": "${fix.path}",`,
    `"target": "${fix.targetField}",`,
    `"source": "${fix.sourceField}",`,
    `"driftEvent": "${fix.driftId}"`,
  ];
  return [
    { kind: "context", text: "[" },
    { kind: "add", text: "  {" },
    ...body.map((t) => ({ kind: "add" as const, text: `    ${t}` })),
    { kind: "add", text: "  }" },
    { kind: "context", text: "]" },
  ];
}

const TOGGLE_ON = "bg-text-primary font-medium text-white dark:bg-white dark:text-black";
const TOGGLE_OFF = "text-text-primary/60 hover:text-text-primary dark:text-white/60 dark:hover:text-white";

/** seismo/aliases.json as a diff. Additive tint, green `+` gutter; the recessed surface keeps it quiet. */
export default function AliasDiff({ fix }: { fix: FixRuleData }) {
  const [mode, setMode] = useState<DiffMode>("unified");
  const { copied, copy } = useCopy();
  const blocked = fix.status === "safety_blocked";

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-box-outline px-5 py-3 dark:border-dark-border">
        <div className="flex items-center gap-2 font-aeonik-mono text-xs">
          <span className="font-semibold text-text-primary dark:text-white">seismo/aliases.json</span>
          <span className="text-[10px] text-text-primary/50 dark:text-white/45">the only file this PR touches</span>
        </div>

        {!blocked && (
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded border border-box-outline/70 p-0.5 font-aeonik-mono text-[10px] dark:border-dark-border">
              {(["unified", "split"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={cn("rounded px-2 py-0.5 uppercase transition-colors", mode === m ? TOGGLE_ON : TOGGLE_OFF)}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => copy(fix.diffAfter, "json")}
              className="rounded border border-box-outline px-2 py-1 font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/70 transition-colors hover:border-text-primary hover:text-text-primary dark:border-dark-border dark:text-white/70 dark:hover:text-white"
            >
              {copied === "json" ? "✓ COPIED" : "COPY RULE"}
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto bg-inset py-3 font-aeonik-mono text-xs dark:bg-dark-inset">
        {blocked ? (
          <div className="mx-auto max-w-lg px-5 py-5 text-center">
            <p className="font-aeonik text-sm font-medium text-warn dark:text-warn-bright">
              No automatic fix for this change
            </p>
            <p className="mx-auto mt-1 max-w-md font-aeonik-light text-xs leading-relaxed text-text-primary/70 dark:text-white/70">
              Anything involving money, logic or saved data is never fixed automatically. A person decides what to do.
            </p>
            <Link
              href="/app/review"
              className="mt-3 inline-flex items-center gap-1.5 rounded border border-btn-primary bg-btn-primary px-3 py-1.5 font-aeonik-mono text-xs uppercase tracking-wider text-white transition-colors hover:border-accent hover:bg-accent dark:border-dark-btn-primary dark:bg-dark-btn-primary"
            >
              Go to review queue ↗
            </Link>
          </div>
        ) : mode === "unified" ? (
          <div key={fix.id} className="min-w-max leading-6">
            {buildLines(fix).map((line, i) => (
              <div
                key={i}
                className={cn(
                  "grid grid-cols-[2rem_1fr] pr-5",
                  line.kind === "add" && "bg-ok/[0.07] dark:bg-ok-bright/[0.08]"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "select-none text-center",
                    line.kind === "add" ? "font-bold text-ok dark:text-ok-bright" : "text-transparent"
                  )}
                >
                  +
                </span>
                <span className="whitespace-pre text-text-primary/80 dark:text-white/80">{line.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <div key={fix.id} className="grid grid-cols-2 divide-x divide-box-outline/50 dark:divide-dark-border/50">
            <div className="px-5">
              <span className="mb-2 block text-[10px] uppercase tracking-wider text-text-primary/40 dark:text-white/40">
                Before
              </span>
              <pre className="text-text-primary/70 dark:text-white/70">{fix.diffBefore}</pre>
            </div>
            <div className="px-5">
              <span className="mb-2 block text-[10px] uppercase tracking-wider text-ok dark:text-ok-bright">After</span>
              <pre className="text-text-primary/80 dark:text-white/80">{fix.diffAfter}</pre>
            </div>
          </div>
        )}
      </div>

      {!blocked && (
        <p className="flex items-center gap-1.5 border-t border-box-outline px-5 py-2.5 font-aeonik-mono text-[11px] text-text-primary/60 dark:border-dark-border dark:text-white/60">
          <span aria-hidden className="text-ok dark:text-ok-bright">
            ✓
          </span>
          Only adds: the old field is kept, nothing is deleted, and old responses still work.
        </p>
      )}
    </Card>
  );
}
