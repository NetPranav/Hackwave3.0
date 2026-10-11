import Reveal from "./Reveal";
import SectionLabel from "./SectionLabel";

const CHIPS = [
  { text: "200 OK", tone: "border-ok/40 bg-ok/10 text-ok" },
  { text: "Monitor: green", tone: "border-ok/40 bg-ok/10 text-ok" },
  { text: "Checkout: wrong", tone: "border-accent/50 bg-accent/10 text-accent" },
];

/** Slide 2: the hook. One renamed field, and nothing tells you. */
export default function Hook() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col justify-center px-6 py-24 md:px-10 lg:px-16">
      <Reveal depth={0.6}>
        <SectionLabel n="1" label="One night, one field" />
      </Reveal>
      <Reveal depth={1}>
        <h2 className="mt-6 font-aeonik text-5xl leading-[0.95] tracking-tight md:text-7xl xl:text-8xl short:xl:text-7xl">
          One field renamed.
          <br />
          <span className="text-accent">Nobody told you.</span>
        </h2>
      </Reveal>

      <Reveal depth={1.6} className="mt-12 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center short:mt-8">
        <pre className="rounded-xl border border-box-outline bg-section p-6 font-aeonik-mono text-lg leading-relaxed md:text-xl">
          <span className="block text-xs uppercase tracking-[0.2em] text-text-primary/45">Yesterday</span>
          <span className="mt-3 block">&quot;amount&quot;: 1000</span>
        </pre>
        <span aria-hidden className="text-center font-aeonik-mono text-3xl text-accent md:text-4xl">&rarr;</span>
        <pre className="rounded-xl border border-accent/60 bg-accent/10 p-6 font-aeonik-mono text-lg leading-relaxed md:text-xl">
          <span className="block text-xs uppercase tracking-[0.2em] text-accent/70">Today</span>
          <span className="mt-3 block text-accent">&quot;total_amount&quot;: 1000</span>
        </pre>
      </Reveal>

      <Reveal depth={2} className="mt-8 flex flex-wrap gap-3 font-aeonik-mono text-xs uppercase tracking-wider short:mt-6">
        {CHIPS.map((c) => (
          <span key={c.text} className={"rounded border px-3 py-2 " + c.tone}>
            {c.text}
          </span>
        ))}
      </Reveal>
    </div>
  );
}
