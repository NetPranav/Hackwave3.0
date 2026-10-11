import Link from "next/link";
import { Card } from "@/components/dashboard/Card";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import { OVERVIEW_STATS as S } from "@/lib/mock/overview";

function Cell({
  href,
  dot,
  count,
  children,
  cta,
}: {
  href: string;
  dot: string;
  count: number;
  children: React.ReactNode;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-dash-bg/40 dark:hover:bg-white/[0.02]"
    >
      <span className="flex items-center gap-3">
        <span aria-hidden className={"h-2 w-2 shrink-0 rounded-full " + dot} />
        <AnimatedNumber value={count} size={28} weight={500} className="font-aeonik text-text-primary dark:text-white" />
        <span className="font-aeonik-light text-sm text-text-primary/75 dark:text-white/75">{children}</span>
      </span>
      <span className="shrink-0 font-aeonik-mono text-[11px] uppercase tracking-wider text-text-primary/50 transition-colors group-hover:text-text-primary dark:text-white/45 dark:group-hover:text-white">
        {cta} ↗
      </span>
    </Link>
  );
}

/** The two things only a person can do: decide on the review items, merge the open fix PRs. */
export default function AttentionBar() {
  const prs = S.openPrNumbers.length;
  return (
    <Card aria-label="Needs your attention">
      <div className="grid grid-cols-1 divide-y divide-box-outline dark:divide-dark-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <Cell href="/app/review" dot="animate-pulse bg-accent" count={S.waitingForReview} cta="Review queue">
          {S.waitingForReview === 1 ? "change needs" : "changes need"} a human decision
        </Cell>
        <Cell href="/app/fixes" dot="bg-ok dark:bg-ok-bright" count={prs} cta="Safe fixes">
          {prs === 1 ? "fix is" : "fixes are"} waiting for you to merge
        </Cell>
      </div>
    </Card>
  );
}
