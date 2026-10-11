import Reveal from "./Reveal";
import SectionLabel from "./SectionLabel";
import { EVIDENCE } from "@/lib/landing";

const LOOP = ["Build", "Deploy", "Provider changes silently", "A user notices", "Days of debugging"];

/** Why uptime checks miss this, then five labelled facts. Every card carries its evidence label. */
export default function Problem() {
  return (
    <section id="problem" className="mx-auto max-w-[1440px] px-6 pb-24 md:px-10 lg:px-16">
      <Reveal>
        <SectionLabel n="1" label="The problem" />
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <h2 className="font-aeonik text-4xl leading-[0.98] tracking-tight md:text-6xl">Documented is not the same as told.</h2>
          <p className="font-aeonik-light text-base leading-relaxed text-text-primary/75 md:text-lg">
            Providers announce changes as sentences in a changelog. Your code cannot read a sentence. Uptime monitors only ask whether the API is up. When a field is renamed, a limit is lowered or a number changes its unit, the API still answers 200 OK, and your app quietly gets it wrong.
          </p>
        </div>
      </Reveal>

      <Reveal className="mt-12">
        <ol className="flex flex-wrap items-center gap-y-3">
          {LOOP.map((step, i) => (
            <li key={step} className="flex items-center">
              <span
                className={
                  "rounded-md border px-3 py-2 font-aeonik-mono text-[11px] uppercase tracking-wider " +
                  (i === 2 ? "border-accent bg-accent/10 text-accent" : "border-box-outline bg-section text-text-primary/70")
                }
              >
                {step}
              </span>
              {i < LOOP.length - 1 && <span aria-hidden className="mx-2 h-px w-5 bg-box-outline sm:w-8" />}
            </li>
          ))}
        </ol>
      </Reveal>

      <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-box-outline bg-box-outline md:grid-cols-2 lg:grid-cols-5">
        {EVIDENCE.map((e, i) => (
          <Reveal key={e.value} delay={i * 0.06} className="bg-section p-5 transition-colors hover:bg-dash-bg">
            <p className="font-aeonik text-2xl leading-tight tracking-tight">{e.value}</p>
            <p className="mt-3 font-aeonik-light text-sm leading-relaxed text-text-primary/70">{e.text}</p>
            <p className="mt-4 font-aeonik-mono text-[10px] uppercase tracking-wider">
              <span className="rounded border border-accent/50 px-1.5 py-0.5 text-accent">{e.tag}</span>
              <span className="ml-2 text-text-primary/45">{e.source}</span>
            </p>
          </Reveal>
        ))}
      </div>
      <p className="mt-4 font-aeonik-light text-sm text-text-primary/55">
        Nobody has measured what silent API drift costs. We say unmeasured and do not invent a number.
      </p>
    </section>
  );
}
