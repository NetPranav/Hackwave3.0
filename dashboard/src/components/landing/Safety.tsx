import { GUARANTEES, LADDER, PROMISES } from "@/lib/landing";
import Reveal from "./Reveal";
import SectionLabel from "./SectionLabel";

/** Why a fix is safe: four proven guarantees, the three-step ladder, and what the SDK promises. */
export default function Safety() {
  return (
    <section id="safe" className="mx-auto max-w-[1440px] px-6 pb-24 md:px-10 lg:px-16">
      <Reveal>
        <SectionLabel n="5" label="Fix safely" />
        <h2 className="mt-6 max-w-4xl font-aeonik text-4xl leading-[0.98] tracking-tight md:text-6xl">Small fixes. Add only. A person merges.</h2>
        <p className="mt-4 max-w-2xl font-aeonik-light text-base leading-relaxed text-text-primary/70">
          A rename fix is one rule in <code className="font-aeonik-mono text-[0.9em]">seismo/aliases.json</code>. It adds the new name only when it is missing. The AI never writes code.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {GUARANTEES.map((g, i) => (
          <Reveal key={g.id} delay={i * 0.06}>
            <div className="group h-full rounded-xl border border-box-outline bg-section p-6 transition-all duration-300 hover:-translate-y-1 hover:border-text-primary">
              <span className="font-aeonik-mono text-xs text-accent">{g.id}</span>
              <h3 className="mt-5 font-aeonik text-xl leading-tight tracking-tight">{g.title}</h3>
              <p className="mt-2 font-aeonik-light text-sm leading-relaxed text-text-primary/65">{g.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <p className="mt-3 font-aeonik-mono text-[11px] uppercase tracking-wider text-text-primary/45">
        Each one is checked with property tests, 10,000 runs each, over random inputs.
      </p>

      <Reveal className="mt-14 grid gap-px overflow-hidden rounded-xl border border-box-outline bg-box-outline md:grid-cols-3">
        {LADDER.map((l, i) => (
          <div key={l.step} className="bg-section p-6">
            <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/45">Rung {i + 1}</p>
            <h3 className="mt-3 font-aeonik text-2xl tracking-tight">{l.step}</h3>
            <p className="mt-2 font-aeonik-light text-sm text-text-primary/65">{l.text}</p>
            <p className="mt-4 font-aeonik-mono text-xs text-accent">{l.who}</p>
          </div>
        ))}
      </Reveal>
      <p className="mt-3 font-aeonik-light text-sm text-text-primary/60">Money, branching and saved-data fields always go to review.</p>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PROMISES.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.06}>
            <div className="h-full border-l-2 border-accent pl-4">
              <h3 className="font-aeonik text-lg tracking-tight">{p.title}</h3>
              <p className="mt-1 font-aeonik-light text-sm leading-relaxed text-text-primary/65">{p.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
