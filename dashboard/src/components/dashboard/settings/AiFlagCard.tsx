"use client";

import { Card } from "@/components/dashboard/Card";
import Switch from "@/components/dashboard/Switch";

/** The AI feature flag. Off means template text everywhere; detection and fixes never depend on it. */
export default function AiFlagCard({ aiOn, onChange }: { aiOn: boolean; onChange: (next: boolean) => void }) {
  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl">
          <h3 className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45">
            AI explanations
          </h3>
          <p className="mt-2 font-aeonik text-base font-medium text-text-primary dark:text-white">
            {aiOn ? "Alerts and review cards are explained by AI." : "Standard text is used everywhere."}
          </p>
          <p className="mt-1 font-aeonik-light text-sm leading-relaxed text-text-primary/70 dark:text-white/70">
            The AI only explains things in words. Finding changes, how serious they are and every suggested fix come from fixed rules,
            so turning it off changes the wording and nothing else. Review cards show a STANDARD TEXT badge when it is off.
          </p>
        </div>
        <Switch checked={aiOn} onChange={onChange} label="AI explanations" />
      </div>
    </Card>
  );
}
