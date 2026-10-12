"use client";

import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { gsap, useGSAP } from "@/lib/gsap";
import Stage from "./Stage";
import Seismograph, { createSignal, type Signal } from "./Seismograph";
import TitleScene from "./scenes/TitleScene";
import HookScene from "./scenes/HookScene";
import EvidenceScene from "./scenes/EvidenceScene";
import QuestionScene from "./scenes/QuestionScene";
import SolutionScene from "./scenes/SolutionScene";
import DemoScene, { DEMO_STEP } from "./scenes/DemoScene";
import SafetyScene from "./scenes/SafetyScene";
import WhyScene from "./scenes/WhyScene";
import CloseScene from "./scenes/CloseScene";
import LaunchOverlay, { type LaunchOverlayHandle } from "./LaunchOverlay";
import { useSteps } from "./useSteps";

/** What the line does on each step. The line never leaves the stage; only these values change. */
const SIGNAL_AT: Partial<Signal>[] = [
  { reveal: 1, calm: 1, quake: 0, heat: 0, y: 790 }, // 1. Title: calm, under the name
  { reveal: 1, calm: 1, quake: 0.55, heat: 1, y: 470 }, // 2a. Hook: the quake, a field changes
  { reveal: 1, calm: 1, quake: 0, heat: 0, y: 470 }, // 2b. Hook: it passes, every signal says fine
  { reveal: 1, calm: 1, quake: 0, heat: 0, y: 760 }, // 3a. Evidence: the line becomes a timeline (tremors come from the scene)
  { reveal: 1, calm: 1, quake: 0, heat: 0, y: 760 }, // 3b. Evidence: the punchline
  { reveal: 1, calm: 0.4, quake: 0, heat: 0, y: 960 }, // 4a. The question: the line steps back and goes quiet
  { reveal: 1, calm: 1, quake: 0, heat: 0, y: 900 }, // 4b. The answer: Seismo
  { reveal: 1, calm: 1, quake: 0, heat: 0, y: 470 }, // 5a. Detect (the tremor comes from the scene)
  { reveal: 1, calm: 1, quake: 0, heat: 0, y: 470 }, // 5b. Impact
  { reveal: 1, calm: 1, quake: 0, heat: 0, y: 470 }, // 5c. Fix
  { reveal: 1, calm: 0.6, quake: 0, heat: 0, y: 470 }, // 6a. Safe by design: the line is the request path
  { reveal: 1, calm: 0.6, quake: 0, heat: 0, y: 470 }, // 6b. Safe by design: the rules
  { reveal: 1, calm: 0.4, quake: 0, heat: 0, y: 1030 }, // 7. Why us: the line steps aside for the table
  { reveal: 1, calm: 1, quake: 0, heat: 0, y: 900 }, // 8. Live demo card (the next click leaves for the real product)
  { reveal: 1, calm: 1, quake: 0, heat: 0, y: 820 }, // 9. Close: calm again, under the promise
];

/** Where the live demo starts (opened in a new tab). Change it with NEXT_PUBLIC_PITCH_DEMO_URL. */
const DEMO_URL = process.env.NEXT_PUBLIC_PITCH_DEMO_URL || "https://seismo-demo-shop.vercel.app/checkout?product=chai";

const LABELS = ["Seismo", "The quake", "Nobody told you", "It keeps happening", "Nothing watches APIs", "The question", "The answer", "Detect", "Impact", "Fix", "It never touches", "It never acts alone", "Why us", "Live demo", "Thank you"];

/** The pitch as one pinned stage: scenes change what is on it. The only page change is the hand-off to the live demo. */
export default function PitchDeck() {
  const overlay = useRef<LaunchOverlayHandle>(null);
  const goRef = useRef<(target: number) => void>(() => {});
  // From the demo card, "next" plays the transition, then opens the live product in a new tab and moves the deck on
  // behind it. If the browser blocks the tab, it goes there in this tab instead.
  const gate = useCallback((from: number) => {
    if (from !== DEMO_STEP) return false;
    // Browsers only allow a new tab right after a key press, click or tap. A mouse wheel is not one, so ignore it here.
    if (!navigator.userActivation?.isActive) return true;
    overlay.current?.open(DEMO_URL, DEMO_STEP + 1, () => goRef.current(DEMO_STEP + 1));
    return true;
  }, []);
  const { step, go } = useSteps(SIGNAL_AT.length, gate);
  useEffect(() => {
    goRef.current = go;
  }, [go]);
  const signal = useRef<Signal>(createSignal());
  const first = useRef(true);

  useGSAP(
    () => {
      const intro = first.current;
      first.current = false;
      gsap.to(signal.current, {
        ...SIGNAL_AT[step],
        duration: intro ? 1.8 : 1.2,
        ease: intro ? "power2.inOut" : "power3.inOut",
        delay: intro ? 0.2 : 0.25,
        overwrite: "auto",
      });
    },
    { dependencies: [step] }
  );

  return (
    <>
      <Stage>
        <Seismograph signal={signal} />
        <TitleScene step={step} />
        <HookScene step={step} />
        <EvidenceScene step={step} signal={signal} />
        <QuestionScene step={step} />
        <SolutionScene step={step} signal={signal} />
        <DemoScene step={step} />
        <SafetyScene step={step} />
        <WhyScene step={step} />
        <CloseScene step={step} />
      </Stage>

      <LaunchOverlay ref={overlay} />

      <nav aria-label="Slides" className="fixed right-5 top-1/2 z-50 flex -translate-y-1/2 flex-col items-end gap-2.5">
        {LABELS.map((label, i) => (
          <button key={label} type="button" onClick={() => go(i)} aria-label={"Go to " + label} aria-current={i === step ? "step" : undefined} className="py-0.5">
            <span className={cn("block h-1.5 rounded-full transition-all duration-300", i === step ? "w-6 bg-accent" : "w-1.5 bg-text-primary/30 hover:bg-text-primary/70")} />
          </button>
        ))}
      </nav>
    </>
  );
}
