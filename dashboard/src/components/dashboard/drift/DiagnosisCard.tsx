import { Card, CardHeader } from "@/components/dashboard/Card";
import type { DriftDetailData } from "@/lib/mock/drift";

/** Two voices, clearly separated: the deterministic detector decides, the AI only explains. */
export default function DiagnosisCard({ drift }: { drift: DriftDetailData }) {
  return (
    <Card>
      <CardHeader title="Diagnosis" />
      <div className="grid grid-cols-1 divide-y divide-box-outline dark:divide-dark-border md:grid-cols-2 md:divide-x md:divide-y-0">
        <section className="px-5 py-4">
          <h4 className="font-aeonik-mono text-[11px] uppercase tracking-wider text-text-primary dark:text-white">
            How it was found
          </h4>
          <p className="mt-0.5 font-aeonik-mono text-[10px] text-text-primary/50 dark:text-white/45">
            Fixed rules, no AI
          </p>
          <p className="mt-3 font-aeonik-light text-xs leading-relaxed text-text-primary/80 dark:text-white/80">
            {drift.detectorReasoning}
          </p>
        </section>
        <section className="px-5 py-4">
          <h4 className="font-aeonik-mono text-[11px] uppercase tracking-wider text-text-primary dark:text-white">
            Explained by AI
          </h4>
          <p className="mt-0.5 font-aeonik-mono text-[10px] text-text-primary/50 dark:text-white/45">
            AI · explains only, never writes code
          </p>
          <p className="mt-3 font-aeonik-light text-xs leading-relaxed text-text-primary/80 dark:text-white/80">
            {drift.aiExplanation}
          </p>
        </section>
      </div>
    </Card>
  );
}
