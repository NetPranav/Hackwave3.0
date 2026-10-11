import { Card, CardHeader } from "@/components/dashboard/Card";
import { plainUsage } from "@/lib/plain";
import { SeverityLabel } from "@/components/dashboard/timeline/EventStatus";
import SuggestionPanel from "@/components/dashboard/review/SuggestionPanel";
import type { EndpointRef } from "@/lib/compare/catalog";
import type { SimResult } from "@/lib/compare/simulate";
import ImpactPath, { type PathNode } from "./ImpactPath";

function pathFor(target: EndpointRef, field: string, result: SimResult): PathNode[] {
  const hit = result.sites.length > 0;
  return [
    { label: target.serviceName },
    { label: target.endpoint.method + " " + target.endpoint.path },
    { label: field, hit },
    hit
      ? { label: result.sites.length + (result.sites.length === 1 ? " place in code" : " places in code"), hit }
      : { label: "no code reads it", muted: true },
    ...result.workflows.map((w) => ({ label: w, hit })),
  ];
}

function Verdict({ target, field, result }: { target: EndpointRef; field: string; result: SimResult }) {
  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <SeverityLabel severity={result.severity} />
        <span className="rounded border border-box-outline px-2 py-0.5 font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/60 dark:border-dark-border dark:text-white/60">
          {result.ladder}
        </span>
        {result.fieldClass !== "plain" && (
          <span className="rounded border border-warn/30 bg-warn/10 px-2 py-0.5 font-aeonik-mono text-[10px] font-medium uppercase tracking-wider text-warn dark:border-warn-bright/30 dark:bg-warn-bright/10 dark:text-warn-bright">
            {result.fieldClass} field
          </span>
        )}
      </div>
      <p className="mt-3 max-w-3xl font-aeonik text-xl font-medium tracking-tight text-text-primary md:text-2xl dark:text-white">
        {result.verdict}
      </p>
      <div className="mt-5">
        <ImpactPath key={target.endpoint.id + field + result.sites.length} nodes={pathFor(target, field, result)} />
      </div>
    </Card>
  );
}

function Coverage({ coverage }: { coverage: SimResult["coverage"] }) {
  return (
    <Card>
      <CardHeader title="Is there already a safe fix for it?" />
      <div className="flex items-start gap-3 p-5">
        <span
          aria-hidden
          className={
            "mt-1.5 h-2 w-2 shrink-0 rounded-full " +
            (coverage.covered ? "bg-ok dark:bg-ok-bright" : "bg-warn dark:bg-warn-bright")
          }
        />
        <div>
          <p className="font-aeonik text-sm font-medium text-text-primary dark:text-white">
            {coverage.covered ? "Yes, already fixed" : "No fix yet"}
          </p>
          <p className="mt-1 font-aeonik-light text-sm leading-relaxed text-text-primary/70 dark:text-white/70">
            {coverage.text}
          </p>
        </div>
      </div>
    </Card>
  );
}

function CallSites({ sites }: { sites: SimResult["sites"] }) {
  return (
    <Card>
      <CardHeader title="Places in your code it would affect" />
      <ul className="divide-y divide-box-outline/50 dark:divide-dark-border/50">
        {sites.map((site) => (
          <li key={site.file + site.line} className="px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 font-aeonik-mono text-xs">
              <span className="font-semibold text-text-primary dark:text-white">
                {site.file}:{site.line}
              </span>
              <span className="text-[11px] text-text-primary/60 dark:text-white/60">
                {plainUsage(site.usageKind)} · {site.workflow}
              </span>
            </div>
            <pre className="mt-2 overflow-x-auto rounded border border-box-outline/60 bg-inset px-3 py-2 font-aeonik-mono text-[11px] text-text-primary/85 dark:border-dark-border dark:bg-dark-inset dark:text-white/85">
              <code>{site.snippet}</code>
            </pre>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** The answer: how bad, the route it travels, whether aliases cover it, what Seismo would suggest, and what it hits. */
export default function SimulationResult({ target, field, result }: { target: EndpointRef; field: string; result: SimResult }) {
  return (
    <div className="space-y-6">
      <Verdict target={target} field={field} result={result} />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Coverage coverage={result.coverage} />
        <Card className="p-5">
          <SuggestionPanel suggestion={result.suggestion} />
        </Card>
      </div>
      {result.sites.length > 0 && <CallSites sites={result.sites} />}
      <p className="px-1 font-aeonik-light text-[11px] text-text-primary/50 dark:text-white/45">
        Worked out from the map of your code and your existing fixes. No AI is used, and nothing is changed.
      </p>
    </div>
  );
}
