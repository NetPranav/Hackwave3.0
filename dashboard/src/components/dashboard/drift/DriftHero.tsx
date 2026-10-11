import Link from "next/link";
import { Card } from "@/components/dashboard/Card";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import { plainFixType } from "@/lib/plain";
import { LifecycleLabel, SeverityLabel } from "@/components/dashboard/timeline/EventStatus";
import type { DriftDetailData } from "@/lib/mock/drift";

const PRIMARY_BUTTON =
  "inline-flex items-center gap-1.5 rounded border border-btn-primary bg-btn-primary px-3 py-1.5 font-aeonik-mono text-xs uppercase tracking-wider text-white transition-colors hover:border-accent hover:bg-accent dark:border-dark-btn-primary dark:bg-dark-btn-primary";
const QUIET_BUTTON =
  "inline-flex items-center gap-1.5 rounded border border-box-outline px-3 py-1.5 font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/80 transition-colors hover:border-text-primary hover:text-text-primary dark:border-dark-border dark:text-white/80 dark:hover:text-white";

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4">
      <dt className="font-aeonik-mono text-[10px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45">
        {label}
      </dt>
      <dd className="mt-1.5 font-aeonik-mono text-xs leading-relaxed text-text-primary dark:text-white">{children}</dd>
    </div>
  );
}

/** What changed, how sure we are, and the next click. The field pair is the headline. */
export default function DriftHero({ drift }: { drift: DriftDetailData }) {
  const [from, to] = drift.field.includes(" → ") ? drift.field.split(" → ") : [drift.field, null];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 md:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/50 dark:text-white/45">
            <span title={"Detector " + drift.detectorId}>{drift.detectorName}</span>
            <span aria-hidden>/</span>
            <span>{drift.detectedAt}</span>
          </div>

          <h2 className="mt-2 flex flex-wrap items-baseline gap-x-3 font-aeonik text-2xl font-medium tracking-tight text-text-primary md:text-3xl dark:text-white">
            <span>{drift.service}</span>
            <span className="inline-flex items-baseline gap-2 font-aeonik-mono text-xl md:text-2xl">
              <span className={to ? "text-text-primary/60 dark:text-white/60" : undefined}>{from}</span>
              {to && (
                <>
                  <span className="text-accent">→</span>
                  <span>{to}</span>
                </>
              )}
            </span>
          </h2>

          <p className="mt-2 font-aeonik-mono text-xs text-text-primary/60 dark:text-white/60">
            {drift.method} {drift.endpoint}
          </p>

          <div className="mt-3 flex items-center gap-3">
            <SeverityLabel severity={drift.severity} />
            <LifecycleLabel state={drift.state} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={"/app/graph?highlight=" + drift.serviceSlug} className={QUIET_BUTTON}>
            Graph ↗
          </Link>
          {drift.fixPrNumber ? (
            <a
              href={"https://github.com/NetPranav/seismo-demo-shop/pull/" + drift.fixPrNumber}
              target="_blank"
              rel="noreferrer"
              className={PRIMARY_BUTTON}
            >
              View PR #{drift.fixPrNumber} ↗
            </a>
          ) : (
            <Link href="/app/review" className={PRIMARY_BUTTON}>
              Open review queue ↗
            </Link>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 divide-x divide-y divide-box-outline border-t border-box-outline dark:divide-dark-border dark:border-dark-border lg:grid-cols-4 lg:divide-y-0">
        <Stat label="Before">{drift.magnitudeShift?.baseline ?? drift.presenceShift.baseline}</Stat>
        <Stat label="Now">{drift.magnitudeShift?.current ?? drift.presenceShift.current}</Stat>
        <Stat label="How sure">
          <span className="flex items-end gap-2">
            <AnimatedNumber value={drift.confidence} size={24} weight={500} className="font-aeonik" />
            <span className="pb-0.5 font-aeonik text-base text-text-primary dark:text-white">%</span>
            <span className="pb-1 text-text-primary/50 dark:text-white/45">no AI involved</span>
          </span>
        </Stat>
        <Stat label="Fix type">{plainFixType(drift.safetyLadderRung)}</Stat>
      </dl>
    </Card>
  );
}
