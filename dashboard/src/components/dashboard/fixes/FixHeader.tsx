"use client";

import Link from "next/link";
import { Card } from "@/components/dashboard/Card";
import { useCopy } from "@/hooks/useCopy";
import { plainFixType } from "@/lib/plain";
import type { FixRuleData } from "@/lib/mock/fixes";

const PRIMARY_BUTTON =
  "inline-flex items-center gap-1.5 rounded border border-btn-primary bg-btn-primary px-3 py-1.5 font-aeonik-mono text-xs uppercase tracking-wider text-white transition-colors hover:border-accent hover:bg-accent dark:border-dark-btn-primary dark:bg-dark-btn-primary";

/** What changed, in one line, and the single thing to do about it. */
export default function FixHeader({ fix }: { fix: FixRuleData }) {
  const { copied, copy } = useCopy();
  const scope = fix.path === "$" ? "applies to the whole response" : `applies at ${fix.path}`;

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/50 dark:text-white/45">
            <span>Rule {fix.ruleId}</span>
            <span className="text-text-primary/30 dark:text-white/30">/</span>
            <span>{fix.driftType}</span>
          </div>

          <h2 className="mt-2 flex flex-wrap items-baseline gap-x-3 font-aeonik text-2xl font-medium tracking-tight text-text-primary md:text-3xl dark:text-white">
            <span>{fix.service}</span>
            <span className="inline-flex items-baseline gap-2 font-aeonik-mono text-xl md:text-2xl">
              <span>{fix.targetField}</span>
              <span className="text-accent">←</span>
              <span className="text-text-primary/60 dark:text-white/60">{fix.sourceField}</span>
            </span>
          </h2>

          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-aeonik-mono text-xs text-text-primary/60 dark:text-white/60">
            <span>
              {fix.method} {fix.endpoint}
            </span>
            <span aria-hidden>·</span>
            <span>{scope}</span>
            <span className="ml-1 rounded border border-box-outline px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-primary/70 dark:border-dark-border dark:text-white/70">
              {plainFixType(fix.safetyLadderRung)}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          {fix.healedHits !== undefined && (
          <span className="inline-flex items-center gap-1 rounded border border-accent/60 px-2 py-0.5 font-aeonik-mono text-[10px] uppercase tracking-wider text-accent">
            Healed live · {fix.healedHits} response{fix.healedHits === 1 ? "" : "s"}
          </span>
        )}
          <Link
            href={`/app/drift/${fix.driftId}`}
            className="font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/60 underline-offset-4 transition-colors hover:text-text-primary hover:underline dark:text-white/60 dark:hover:text-white"
          >
            See the change ↗
          </Link>
          {fix.fixPrNumber ? (
            <a href={fix.prUrl} target="_blank" rel="noreferrer" className={PRIMARY_BUTTON}>
              <span>VIEW PR #{fix.fixPrNumber}</span>
              <span aria-hidden>↗</span>
            </a>
          ) : (
            <Link href="/app/review" className={PRIMARY_BUTTON}>
              <span>OPEN REVIEW QUEUE</span>
              <span aria-hidden>↗</span>
            </Link>
          )}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2 border-t border-box-outline/50 pt-4 font-aeonik-mono text-xs dark:border-dark-border/50 md:grid-cols-[auto_1fr]">
        <dt className="text-text-primary/40 dark:text-white/40">BRANCH</dt>
        <dd className="flex items-center gap-2 text-text-primary dark:text-white">
          <span className="font-semibold">{fix.branchName}</span>
          <button
            type="button"
            onClick={() => copy(`git checkout ${fix.branchName}`, "branch")}
            className="text-[10px] text-text-primary/40 transition-colors hover:text-text-primary dark:text-white/40 dark:hover:text-white"
          >
            {copied === "branch" ? "✓ COPIED" : "COPY"}
          </button>
        </dd>
        <dt className="text-text-primary/40 dark:text-white/40">AFFECTS</dt>
        <dd className="text-text-primary dark:text-white">{fix.impactWorkflows.join(" · ")}</dd>
      </dl>
    </Card>
  );
}
