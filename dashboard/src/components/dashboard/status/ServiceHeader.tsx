import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/dashboard/Card";
import Sparkline from "@/components/dashboard/Sparkline";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import type { ProviderHealth, ServiceStatusItem } from "@/lib/mock/status";
import { DOT_CLASS, STATE_META, TEXT_CLASS } from "./StateLabel";

const PROVIDER_DOT: Record<ProviderHealth, string> = {
  operational: "bg-ok dark:bg-ok-bright",
  degraded: "bg-warn dark:bg-warn-bright animate-pulse",
  outage: "bg-accent animate-pulse",
};

const LINK_BUTTON =
  "inline-flex items-center gap-1.5 rounded border border-box-outline px-3 py-1.5 font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/80 transition-colors hover:border-text-primary hover:text-text-primary dark:border-dark-border dark:text-white/80 dark:hover:text-white";
const PRIMARY_BUTTON =
  "inline-flex items-center gap-1.5 rounded border border-btn-primary bg-btn-primary px-3 py-1.5 font-aeonik-mono text-xs uppercase tracking-wider text-white transition-colors hover:border-accent hover:bg-accent dark:border-dark-btn-primary dark:bg-dark-btn-primary";

function Unit({ children }: { children: React.ReactNode }) {
  return (
    <span className="-ml-1.5 self-end pb-1 font-aeonik-mono text-xs font-normal text-text-primary/50 dark:text-white/45">
      {children}
    </span>
  );
}

function Stat({ label, hint, tone, children }: { label: string; hint?: string; tone?: "warn" | "bad"; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4">
      <dt title={hint} className="font-aeonik-mono text-[10px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1.5 flex items-center gap-2.5 font-aeonik text-2xl font-medium tracking-tight",
          tone === "warn" && "text-warn dark:text-warn-bright",
          tone === "bad" && "text-bad dark:text-bad-bright",
          !tone && "text-text-primary dark:text-white"
        )}
      >
        {children}
      </dd>
    </div>
  );
}

/** Who this is, what changed (the one coloured sentence), what to do next, and four quiet stats. */
export default function ServiceHeader({ service }: { service: ServiceStatusItem }) {
  const meta = STATE_META[service.state];
  const hasChange = service.state !== "normal";

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 md:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-aeonik text-2xl font-medium tracking-tight text-text-primary md:text-3xl dark:text-white">
              {service.name}
            </h2>
            <span className="font-aeonik-mono text-xs text-text-primary/50 dark:text-white/45">{service.host}</span>
          </div>

          <p
            className={cn(
              "mt-2 flex items-center gap-2 font-aeonik-mono text-xs font-medium",
              TEXT_CLASS[meta.tone]
            )}
          >
            <span
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASS[meta.tone], meta.tone === "accent" && "animate-pulse")}
            />
            <span>{hasChange ? service.stateDescription : `All ${service.fieldsMapped} fields look normal`}</span>
          </p>

          {service.deprecationNotice && (
            <p className="mt-1.5 flex items-center gap-2 font-aeonik-mono text-xs text-warn dark:text-warn-bright">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn dark:bg-warn-bright" />
              <span>{service.deprecationNotice}</span>
            </p>
          )}

          <p className="mt-3 flex items-center gap-2 font-aeonik-mono text-[11px] text-text-primary/50 dark:text-white/45">
            <span className={cn("h-1.5 w-1.5 rounded-full", PROVIDER_DOT[service.providerStatus])} />
            <a
              href={service.providerStatusUrl}
              target="_blank"
              rel="noreferrer"
              className="uppercase underline-offset-4 hover:text-text-primary hover:underline dark:hover:text-white"
            >
              Provider {service.providerStatus} ↗
            </a>
            <span aria-hidden>·</span>
            <span>seen {service.lastSeen}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/app/graph?highlight=${service.slug}`} className={LINK_BUTTON}>
            Graph ↗
          </Link>
          {service.state === "fix_pending" && (
            <Link href="/app/fixes" className={PRIMARY_BUTTON}>
              View fix ↗
            </Link>
          )}
          {(service.state === "changed" || service.state === "under_review") && (
            <Link href="/app/timeline" className={PRIMARY_BUTTON}>
              See in timeline ↗
            </Link>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 divide-x divide-y divide-box-outline border-t border-box-outline dark:divide-dark-border dark:border-dark-border lg:grid-cols-4 lg:divide-y-0">
        <Stat label="Traffic" hint="Requests per minute">
          <Sparkline values={service.sparkline} className="h-5" />
          <AnimatedNumber value={service.callsPerMin} grouped size={28} weight={500} />
          <Unit>req/m</Unit>
        </Stat>
        <Stat label="Response time" hint="95 out of 100 responses are faster than this (p95)">
          <AnimatedNumber value={service.p95LatencyMs} size={28} weight={500} />
          <Unit>ms</Unit>
        </Stat>
        <Stat label="Errors" hint="Share of requests that failed" tone={service.errorRatePercent >= 1 ? "bad" : undefined}>
          <AnimatedNumber value={service.errorRatePercent} decimals={2} size={28} weight={500} />
          <Unit>%</Unit>
        </Stat>
        <Stat label="Rate-limited" hint="Times the provider said too many requests (HTTP 429)" tone={service.rateLimits429 > 0 ? "warn" : undefined}>
          <AnimatedNumber value={service.rateLimits429} size={28} weight={500} />
        </Stat>
      </dl>
    </Card>
  );
}
