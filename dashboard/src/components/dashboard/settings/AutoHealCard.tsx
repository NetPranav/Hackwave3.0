"use client";

import { Card } from "@/components/dashboard/Card";
import Switch from "@/components/dashboard/Switch";

/** v3-P2: self-healing renames. On: a checked rename rule reaches the running app within 30 s, before its PR is merged. */
export default function AutoHealCard({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl">
          <h3 className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45">
            Self-heal renames
          </h3>
          <p className="mt-2 font-aeonik text-base font-medium text-text-primary dark:text-white">
            {on ? "Renamed fields are healed in your running app within 30 seconds." : "Renames wait until you merge the fix PR."}
          </p>
          <p className="mt-1 font-aeonik-light text-sm leading-relaxed text-text-primary/70 dark:text-white/70">
            Only rename rules that passed every check (C1–C9) are sent to the SDK. They only add the missing field back under its
            old name and never change or remove anything. The PR still opens so the rule is kept in your repo. Type, unit and value
            changes always wait for a person. Turning this off removes live rules within 30 seconds.
          </p>
        </div>
        <Switch checked={on} onChange={onChange} label="Self-heal renames" />
      </div>
    </Card>
  );
}
