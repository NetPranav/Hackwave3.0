import Link from "next/link";
import { Card } from "@/components/dashboard/Card";
import { DRIFT_DETAILS_MAP } from "@/lib/mock/drift";
import DriftHero from "./DriftHero";
import EvidenceCard from "./EvidenceCard";
import DiagnosisCard from "./DiagnosisCard";
import ImpactCard from "./ImpactCard";
import ProposedFixCard from "./ProposedFixCard";

function NoDetail() {
  return (
    <Card className="px-5 py-12 text-center">
      <p className="font-aeonik text-base font-medium text-text-primary dark:text-white">
        No inspector data for this event yet
      </p>
      <p className="mt-1 font-aeonik-light text-sm text-text-primary/60 dark:text-white/60">
        Only a few mock events have a full detail view. The real API will cover them all.
      </p>
      <Link
        href="/app/timeline"
        className="mt-4 inline-block font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/70 underline-offset-4 hover:text-text-primary hover:underline dark:text-white/70 dark:hover:text-white"
      >
        Back to timeline ↗
      </Link>
    </Card>
  );
}

/** One drift event as a single story: what changed, why, what it touches, what to do. */
export default function DriftView({ id }: { id: string }) {
  const drift = DRIFT_DETAILS_MAP[id];

  return (
    <main className="mx-auto max-w-[1440px] space-y-6 px-6 py-6 md:px-10 lg:px-16">
      {drift ? (
        <>
          <DriftHero drift={drift} />
          <EvidenceCard drift={drift} />
          <DiagnosisCard drift={drift} />
          <ImpactCard drift={drift} />
          <ProposedFixCard drift={drift} />
        </>
      ) : (
        <NoDetail />
      )}
    </main>
  );
}
