import Reveal from "./Reveal";
import SectionLabel from "./SectionLabel";

const TILES = [
  { title: "Read-only", text: "The SDK never changes a response. If Seismo is down, your app does not notice." },
  { title: "Shapes, not values", text: "Types and lengths leave your server. Customer data never does." },
  { title: "AI never writes code", text: "Plain code detects. AI only explains." },
  { title: "Add only", text: "A fix adds a field. The old field always wins. A human merges." },
];

/** Slide 6: why you can trust it. Four promises, big and short. */
export default function Safety() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col justify-center px-6 py-24 md:px-10 lg:px-16">
      <Reveal depth={0.6}>
        <SectionLabel n="5" label="Why you can trust it" />
      </Reveal>
      <Reveal depth={1}>
        <h2 className="mt-6 font-aeonik text-5xl leading-[0.95] tracking-tight md:text-7xl short:md:text-6xl">Safe by design.</h2>
      </Reveal>

      <div className="mt-12 grid gap-4 md:grid-cols-2 short:mt-8">
        {TILES.map((t, i) => (
          <Reveal key={t.title} depth={1.4 + i * 0.25}>
            <div className="group h-full rounded-xl border border-box-outline bg-section p-7 transition-colors hover:border-accent">
              <p className="font-aeonik-mono text-xs text-accent">0{i + 1}</p>
              <h3 className="mt-4 font-aeonik text-3xl tracking-tight short:text-2xl">{t.title}</h3>
              <p className="mt-3 font-aeonik-light text-lg leading-snug text-text-primary/70 short:text-base">{t.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
