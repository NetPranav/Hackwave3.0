import type { Metadata } from "next";
import Deck, { type SlideMeta } from "@/components/landing/deck/Deck";
import DeckNav from "@/components/landing/deck/DeckNav";
import Slide from "@/components/landing/deck/Slide";
import Hero from "@/components/landing/Hero";
import Problem from "@/components/landing/Problem";
import Evidence from "@/components/landing/Evidence";
import Catch from "@/components/landing/Catch";
import LiveDemo from "@/components/landing/LiveDemo";
import Approach from "@/components/landing/Approach";
import ProductTabs from "@/components/landing/ProductTabs";
import Safety from "@/components/landing/Safety";
import Compare from "@/components/landing/Compare";
import Faq from "@/components/landing/Faq";
import FinalCta from "@/components/landing/FinalCta";

export const metadata: Metadata = {
  title: "Seismo · Dependabot for the APIs you depend on",
  description: "Seismo catches silent changes in the APIs you depend on, shows which of your code breaks, and opens a safe fix pull request.",
};

/** The landing page is a deck: one slide per screen, in the order of the pitch. */
const SLIDES: (SlideMeta & { render: () => React.ReactNode })[] = [
  { id: "start", label: "Start", render: () => <Hero /> },
  { id: "problem", label: "The problem", render: () => <Problem /> },
  { id: "evidence", label: "Evidence", dark: true, render: () => <Evidence /> },
  { id: "catch", label: "What we catch", render: () => <Catch /> },
  { id: "demo", label: "Try it", render: () => <LiveDemo /> },
  { id: "how", label: "How it works", dark: true, render: () => <Approach /> },
  { id: "product", label: "Detect · Map · Fix", render: () => <ProductTabs /> },
  { id: "safe", label: "Fix safely", render: () => <Safety /> },
  { id: "compare", label: "Compare", dark: true, render: () => <Compare /> },
  { id: "faq", label: "Questions", render: () => <Faq /> },
  { id: "start-now", label: "Get started", render: () => <FinalCta /> },
];

const META: SlideMeta[] = SLIDES.map(({ id, label, dark }) => ({ id, label, dark }));

export default function LandingPage() {
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
