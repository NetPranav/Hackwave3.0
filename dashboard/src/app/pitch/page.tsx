import type { Metadata } from "next";
import Deck, { type SlideMeta } from "@/components/pitch/deck/Deck";
import DeckNav from "@/components/pitch/deck/DeckNav";
import Slide from "@/components/pitch/deck/Slide";
import Hero from "@/components/pitch/Hero";
import Hook from "@/components/pitch/Hook";
import Problem from "@/components/pitch/Problem";
import Evidence from "@/components/pitch/Evidence";
import LiveDemo from "@/components/pitch/LiveDemo";
import Approach from "@/components/pitch/Approach";
import Safety from "@/components/pitch/Safety";
import Compare from "@/components/pitch/Compare";
import FinalCta from "@/components/pitch/FinalCta";

export const metadata: Metadata = {
  title: "Seismo · Pitch",
  description: "Seismo catches silent changes in the APIs you depend on, shows which of your code breaks, and opens a safe fix pull request.",
};

/** The pitch deck: hook, proof, problem, solution, live demo, trust, why us, close. */
const SLIDES: (SlideMeta & { render: () => React.ReactNode })[] = [
  { id: "start", label: "Seismo", render: () => <Hero /> },
  { id: "hook", label: "The hook", render: () => <Hook /> },
  { id: "evidence", label: "It keeps happening", dark: true, render: () => <Evidence /> },
  { id: "problem", label: "The problem", render: () => <Problem /> },
  { id: "how", label: "The solution", dark: true, render: () => <Approach /> },
  { id: "demo", label: "Live demo", render: () => <LiveDemo /> },
  { id: "safe", label: "Why you can trust it", render: () => <Safety /> },
  { id: "compare", label: "Why us", dark: true, render: () => <Compare /> },
  { id: "start-now", label: "Thank you", render: () => <FinalCta /> },
];

const META: SlideMeta[] = SLIDES.map(({ id, label, dark }) => ({ id, label, dark }));

export default function PitchPage() {
  return (
    <Deck slides={META} nav={<DeckNav />}>
      {SLIDES.map((s, i) => (
        <Slide key={s.id} index={i} id={s.id} label={s.label} dark={s.dark}>
          {s.render()}
        </Slide>
      ))}
    </Deck>
  );
}
