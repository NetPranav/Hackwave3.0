import Link from "next/link";
import { Card, CardHeader } from "@/components/dashboard/Card";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import type { DriftDetailData } from "@/lib/mock/drift";

type AliasRule = DriftDetailData["aliasRule"];

function ruleLines(rule: AliasRule): string[] {
  return [
    "{",
    '  "endpoint": "' + rule.endpoint + '",',
    '  "source": "' + rule.source + '",',
    '  "target": "' + rule.target + '"',
    "}",
  ];
}

function RulePreview({ rule }: { rule: AliasRule }) {
  return (
    <div className="overflow-x-auto rounded border border-box-outline/70 bg-inset py-3 font-aeonik-mono text-xs leading-6 dark:border-dark-border dark:bg-dark-inset">
      {ruleLines(rule).map((text, i) => (
        <div key={i} className="grid grid-cols-[2rem_1fr] bg-ok/[0.07] pr-4 dark:bg-ok-bright/[0.08]">
          <span aria-hidden className="select-none text-center font-bold text-ok dark:text-ok-bright">
            +
          </span>
          <span className="whitespace-pre text-text-primary/80 dark:text-white/80">{text}</span>
        </div>
      ))}
    </div>
  );
}

function ReviewNotice() {
  return (
    <div className="rounded border border-box-outline/70 bg-inset px-5 py-5 text-center dark:border-dark-border dark:bg-dark-inset">
      <p className="font-aeonik text-sm font-medium text-warn dark:text-warn-bright">No automatic fix for this change</p>
      <p className="mx-auto mt-1 max-w-md font-aeonik-light text-xs leading-relaxed text-text-primary/70 dark:text-white/70">
        Anything involving money, logic or saved data is never fixed automatically. A person decides what to do.
      </p>
    </div>
  );
}

/** The fix, or the reason there is none, and the checks behind that call. */
export default function ProposedFixCard({ drift }: { drift: DriftDetailData }) {
  const isAlias = drift.safetyLadderRung.startsWith("Rung 1");
  const passed = drift.checks.filter((c) => c.passed).length;

  return (
    <Card>
      <CardHeader
        title={isAlias ? "Suggested fix · one small rule" : "Needs a person"}
        aside={
          <span className="inline-flex items-end gap-1.5 font-aeonik-mono text-xs font-medium text-ok dark:text-ok-bright">
            <AnimatedNumber value={passed} size={14} weight={500} />
            <span>/ {drift.checks.length} CHECKS PASSED</span>
          </span>
        }
      />
      <div className="space-y-4 p-5">
        {isAlias ? <RulePreview rule={drift.aliasRule} /> : <ReviewNotice />}

        <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {drift.checks.map((check) => (
            <li key={check.id} className="flex items-start gap-2 font-aeonik-mono text-xs">
              <span
                aria-hidden
                className={
                  check.passed ? "font-bold text-ok dark:text-ok-bright" : "font-bold text-warn dark:text-warn-bright"
                }
              >
                {check.passed ? "✓" : "!"}
              </span>
              <span className="font-semibold text-text-primary dark:text-white">{check.id.slice(1)}.</span>
              <span className="text-text-primary/70 dark:text-white/70">{check.label}</span>
            </li>
          ))}
        </ul>

        <div className="border-t border-box-outline/50 pt-4 dark:border-dark-border/50">
          <Link
            href={isAlias ? "/app/fixes" : "/app/review"}
            className="font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/70 underline-offset-4 transition-colors hover:text-text-primary hover:underline dark:text-white/70 dark:hover:text-white"
          >
            {isAlias ? "See all safety checks and the proof ↗" : "Open the review queue ↗"}
          </Link>
        </div>
      </div>
    </Card>
  );
}
