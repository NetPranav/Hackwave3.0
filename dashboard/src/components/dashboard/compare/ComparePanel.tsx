import Link from "next/link";
import { Card, CardHeader } from "@/components/dashboard/Card";
import PayloadPanel from "@/components/dashboard/PayloadDiff";
import { samplesFor } from "@/lib/compare/samples";
import type { EndpointRef } from "@/lib/compare/catalog";

/** Baseline vs now for one endpoint, as synthetic shape tokens. Changed keys are tinted. */
export default function ComparePanel({ target }: { target: EndpointRef }) {
  const { baseline, observed, changedCount } = samplesFor(target.endpoint);

  return (
    <Card>
      <CardHeader
        title={target.endpoint.method + " " + target.endpoint.path}
        aside={
          <Link
            href={"/app/status/" + target.serviceSlug}
            className="font-aeonik-mono text-[11px] uppercase tracking-wider text-text-primary/60 underline-offset-4 hover:text-text-primary hover:underline dark:text-white/60 dark:hover:text-white"
          >
            {target.serviceName} status ↗
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
        <PayloadPanel title="Before" tag="how it normally looks" payload={baseline} other={observed} side="before" />
        <PayloadPanel title="Now" tag="how it looks today" payload={observed} other={baseline} side="after" />
      </div>
      <p className="border-t border-box-outline px-5 py-2.5 font-aeonik-mono text-[11px] text-text-primary/50 dark:border-dark-border dark:text-white/45">
        {changedCount === 0 ? "No differences: every field looks the way it always has." : changedCount + " field" + (changedCount === 1 ? "" : "s") + " differ."}{" "}
        Shapes only: values are never stored or shown.
      </p>
    </Card>
  );
}
