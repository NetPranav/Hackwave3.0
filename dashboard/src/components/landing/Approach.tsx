import { Threads } from "@/components/ui";
import { PIPELINE, STEPS } from "@/lib/landing";
import Reveal from "./Reveal";

/** Dark band: the three steps, then the pipeline. White threads drift behind it. */
export default function Approach() {
  return (
    <section id="how" className="px-3 pb-24 md:px-6">
      <div className="relative isolate mx-auto max-w-[1440px] overflow-hidden rounded-xl bg-btn-primary text-white">
        <div aria-hidden className="absolute inset-0 -z-10">
          <Threads
            color="#ffffff"
            accentColor="#ff6e3e"
            lineCount={60}
            thickness={0.45}
            amplitude={1.3}
            distance={0.5}
            speed={0.35}
            angle={-12}
            taper={0.9}
            brightness={1}
            parting={0.5}
            enableMouseInteraction
            fade={0.4}
            opacity={0.35}
          />
        </div>

        <div className="px-6 py-16 md:px-12 md:py-24">
          <Reveal>
            <p className="flex items-center gap-3 font-aeonik-mono text-sm uppercase tracking-[0.15em] text-accent">
              <span className="flex h-7 w-7 items-center justify-center rounded border border-accent text-xs">4</span>
              How it works
            </p>
            <h2 className="mt-6 max-w-4xl font-aeonik text-4xl leading-[0.98] tracking-tight md:text-6xl">
              Three steps. No proxy. Nothing in your request path.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <div className="group h-full rounded-lg border border-white/15 bg-white/[0.04] p-6 backdrop-blur-sm transition-colors hover:border-accent/70 hover:bg-white/[0.07]">
                  <p className="font-aeonik-mono text-sm text-accent">{s.n}</p>
                  <h3 className="mt-6 font-aeonik text-2xl tracking-tight">{s.title}</h3>
                  <p className="mt-3 font-aeonik-light text-sm leading-relaxed text-white/65">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-12">
            <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-white/45">What happens to one response</p>
            <ol className="mt-4 flex flex-wrap items-center gap-y-3">
              {PIPELINE.map((p, i) => (
                <li key={p} className="flex items-center">
                  <span className="rounded-md border border-dashed border-white/30 px-3 py-2 font-aeonik-mono text-[11px] uppercase tracking-wider text-white/85">{p}</span>
                  {i < PIPELINE.length - 1 && <span aria-hidden className="mx-2 font-aeonik-mono text-accent">→</span>}
                </li>
              ))}
            </ol>
            <p className="mt-5 max-w-2xl font-aeonik-light text-sm leading-relaxed text-white/60">
              AI sits beside this line, not on it. It explains and classifies. Plain code decides what changed, and the AI never sees raw response data.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
