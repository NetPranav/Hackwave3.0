import { Card, CardHeader } from "@/components/dashboard/Card";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import { plainUsage } from "@/lib/plain";
import type { DriftDetailData } from "@/lib/mock/drift";

/** Where your own code reads the changed field, from the code scanner. */
export default function ImpactCard({ drift }: { drift: DriftDetailData }) {
  const workflows = new Set(drift.codeSites.map((s) => s.workflow)).size;

  return (
    <Card>
      <CardHeader
        title="What it affects · where your code uses this"
        aside={
          <span className="inline-flex items-end gap-1.5 font-aeonik-mono text-[11px] text-text-primary/50 dark:text-white/45">
            <AnimatedNumber value={drift.codeSites.length} size={12} />
            <span>places in your code ·</span>
            <AnimatedNumber value={workflows} size={12} />
            <span>features</span>
          </span>
        }
      />
      <ul className="divide-y divide-box-outline/50 dark:divide-dark-border/50">
        {drift.codeSites.map((site) => (
          <li key={site.file + site.line} className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2 font-aeonik-mono text-xs">
              <span className="font-semibold text-text-primary dark:text-white">
                {site.file}:{site.line}
              </span>
              <span className="flex items-center gap-2 text-[11px] text-text-primary/60 dark:text-white/60">
                <span className="rounded border border-box-outline/60 px-2 py-0.5 dark:border-dark-border/60">
                  {plainUsage(site.usageKind)}
                </span>
                <span>{site.workflow}</span>
              </span>
            </div>
            <pre className="mt-2.5 overflow-x-auto rounded border border-box-outline/60 bg-inset px-3 py-2 font-aeonik-mono text-[11px] text-text-primary/85 dark:border-dark-border dark:bg-dark-inset dark:text-white/85">
              <code>{site.snippet}</code>
            </pre>
          </li>
        ))}
      </ul>
    </Card>
  );
}
