"use client";

import { useState } from "react";
import Link from "next/link";
import StepShell, { type StepState } from "./StepShell";
import ConnectStep from "./ConnectStep";
import ScanStep from "./ScanStep";
import SdkStep from "./SdkStep";
import PrStep from "./PrStep";
import DoneCard from "./DoneCard";

const STEPS = [
  { id: "connect", title: "Connect your GitHub", hint: "Seismo is installed. This is what it can read.", optional: false },
  { id: "scan", title: "Scan your code", hint: "We find every API call and the fields your code reads.", optional: false },
  { id: "sdk", title: "Add the SDK", hint: "Two lines. It only watches. It never blocks your app.", optional: true },
  { id: "pr", title: "Merge the setup pull request", hint: "A small one-time change so fixes have a place to go.", optional: true },
];

/** First-run guide. The list on the left shows where you are; the step you are on opens on the right, one at a time. */
export default function OnboardingView() {
  const [current, setCurrent] = useState(0);
  const [skipped, setSkipped] = useState<string[]>([]);
  const finished = current >= STEPS.length;

  const next = () => setCurrent((c) => c + 1);
  const skip = (id: string) => {
    setSkipped((s) => [...s, id]);
    next();
  };

  const stateOf = (index: number, id: string): StepState => {
    if (index === current) return "active";
    if (index > current) return "locked";
    return skipped.includes(id) ? "skipped" : "done";
  };

  const body = (id: string) => {
    if (id === "connect") return <ConnectStep onNext={next} />;
    if (id === "scan") return <ScanStep onNext={next} />;
    if (id === "sdk") return <SdkStep onNext={next} onSkip={() => skip("sdk")} />;
    return <PrStep onNext={next} onSkip={() => skip("pr")} />;
  };

  return (
    <main className="grid flex-1 gap-8 py-6 lg:min-h-0 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-14">
      <section className="flex flex-col justify-center">
        <h1 className="font-aeonik text-4xl leading-[0.95] tracking-tight md:text-5xl xl:text-6xl">Let us connect your code.</h1>
        <p className="mb-8 mt-4 max-w-md font-aeonik-light text-sm leading-relaxed text-text-primary/70 md:text-base">
          A few minutes, one step at a time. You can reach the dashboard after step two.
        </p>
        <ol>
          {STEPS.map((step, i) => (
            <StepShell key={step.id} index={i + 1} {...step} state={stateOf(i, step.id)} last={i === STEPS.length - 1} />
          ))}
        </ol>
        {current >= 2 && !finished && (
          <Link
            href="/app"
            className="mt-1 w-fit font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/60 underline-offset-4 hover:text-text-primary hover:underline"
          >
            Skip to the dashboard →
          </Link>
        )}
      </section>

      <section className={`flex min-h-[420px] flex-col justify-center rounded-xl border border-box-outline bg-section p-6 md:p-10 lg:min-h-0`}>
        {finished ? (
          <DoneCard />
        ) : (
          <div>
            <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-accent">
              Step {current + 1} of {STEPS.length}
              {STEPS[current].optional && " · Optional"}
            </p>
            <h2 className="mt-3 font-aeonik text-3xl tracking-tight md:text-4xl">{STEPS[current].title}</h2>
            <p className="mb-6 mt-2 max-w-xl font-aeonik-light text-sm text-text-primary/60 md:text-base">{STEPS[current].hint}</p>
            {body(STEPS[current].id)}
          </div>
        )}
      </section>
    </main>
  );
}
