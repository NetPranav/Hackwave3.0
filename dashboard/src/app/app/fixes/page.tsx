"use client";

import { useState } from "react";
import PipelineStepper, { type PipelineStep } from "@/components/dashboard/PipelineStepper";
import { Card } from "@/components/dashboard/Card";
import FixList from "@/components/dashboard/fixes/FixList";
import FixHeader from "@/components/dashboard/fixes/FixHeader";
import SafetyGate from "@/components/dashboard/fixes/SafetyGate";
import AliasDiff from "@/components/dashboard/fixes/AliasDiff";
import AliasProof from "@/components/dashboard/fixes/AliasProof";
import { FIX_RULES, type FixStatus } from "@/lib/mock/fixes";

function matchesStage(status: FixStatus, stage: string): boolean {
  switch (stage) {
    case "pr_open":
      return status === "pr_open" || status === "ci_green";
    case "ci_green":
      return status === "ci_green";
    case "merged":
      return status === "merged";
    case "safety_blocked":
      return status === "safety_blocked";
    default:
      return true;
  }
}

export default function FixesPage() {
  const [stage, setStage] = useState("all");
  const [selectedId, setSelectedId] = useState(FIX_RULES[0].id);

  const visible = FIX_RULES.filter((f) => matchesStage(f.status, stage));
  const selected = visible.find((f) => f.id === selectedId) ?? visible[0];

  const countIn = (s: string) => FIX_RULES.filter((f) => matchesStage(f.status, s)).length;
  const steps: PipelineStep[] = [
    { value: "all", label: "FOUND", count: countIn("all"), caption: "changes with a fix ready" },
    { value: "pr_open", label: "PR OPEN", count: countIn("pr_open"), caption: "waiting for you to merge", tone: "accent" },
    { value: "ci_green", label: "TESTS PASS", count: countIn("ci_green"), caption: "the shop's tests pass with the fix", tone: "ok" },
    { value: "merged", label: "MERGED", count: countIn("merged"), caption: "the fix is live", tone: "ok" },
    { value: "safety_blocked", label: "NEEDS A PERSON", count: countIn("safety_blocked"), caption: "cannot be fixed automatically", tone: "warn", branch: true },
  ];

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-6 md:px-10 lg:px-16">
      <PipelineStepper className="mb-6" steps={steps} activeValue={stage} onSelect={setStage} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <aside className="space-y-4 lg:col-span-4">
          <FixList fixes={visible} selectedId={selected?.id} onSelect={setSelectedId} />
          <p className="px-1 font-aeonik-light text-[11px] leading-relaxed text-text-primary/50 dark:text-white/45">
            A fix is a small rule saved in one file (<code className="font-aeonik-mono">seismo/aliases.json</code>). The AI
            never writes code, and anything involving money, logic or saved data always goes to a person.
          </p>
        </aside>

        <div className="space-y-6 lg:col-span-8">
          {selected ? (
            <>
              <FixHeader fix={selected} />
              <SafetyGate key={`gate-${selected.id}`} checks={selected.checks} />
              <AliasDiff key={`diff-${selected.id}`} fix={selected} />
              <AliasProof key={`proof-${selected.id}`} fix={selected} />
            </>
          ) : (
            <Card className="px-5 py-12 text-center font-aeonik-light text-sm text-text-primary/60 dark:text-white/60">
              Select a stage above to see its rules.
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
