import { Card, CardHeader } from "@/components/dashboard/Card";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import PayloadPanel from "@/components/dashboard/PayloadDiff";
import type { DriftDetailData } from "@/lib/mock/drift";

/** Baseline next to what the API returns now, with the differing keys marked. Synthetic values only. */
export default function EvidenceCard({ drift }: { drift: DriftDetailData }) {
  return (
    <Card>
      <CardHeader
        title="Evidence · what the API returned"
        aside={
          <span className="inline-flex items-end gap-1.5 font-aeonik-mono text-[11px] text-text-primary/50 dark:text-white/45">
            <AnimatedNumber value={drift.samplesObserved} grouped size={12} />
            <span>samples</span>
          </span>
        }
      />
      <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
        <PayloadPanel title="Before" tag="how it used to be" payload={drift.baselinePayload} other={drift.observedPayload} side="before" />
        <PayloadPanel title="Now" tag="how it is now" payload={drift.observedPayload} other={drift.baselinePayload} side="after" />
      </div>
      <p className="border-t border-box-outline px-5 py-2.5 font-aeonik-mono text-[11px] text-text-primary/50 dark:border-dark-border dark:text-white/45">
        Sample shapes only: real customer data is never stored or shown.
      </p>
    </Card>
  );
}
