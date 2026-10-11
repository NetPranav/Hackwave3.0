import Link from "next/link";
import { SCAN_RESULT } from "@/lib/mock/onboarding";

/** The last card: what Seismo knows now, and where to go next. */
export default function DoneCard() {
  return (
    <div className="rounded-md border border-box-outline bg-section p-6 md:p-8">
      <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-accent">You are set up</p>
      <h2 className="mt-3 font-aeonik text-3xl tracking-tight md:text-4xl">Seismo is watching {SCAN_RESULT.services} APIs.</h2>
      <p className="mt-2 font-aeonik-light text-sm text-text-primary/60">
        {SCAN_RESULT.fieldsMapped} fields are mapped to the code that uses them. You will hear about a change where you set up alerts.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/app"
          className="rounded-md bg-accent px-6 py-3 font-aeonik-mono text-sm uppercase tracking-wider text-white transition-transform hover:scale-[1.02]"
        >
          Open the dashboard
        </Link>
        <Link
          href="/app/graph"
          className="rounded-md border border-box-outline px-6 py-3 font-aeonik-mono text-sm uppercase tracking-wider text-text-primary/80 transition-colors hover:border-text-primary"
        >
          See the graph
        </Link>
      </div>
    </div>
  );
}
