import { Threads } from "@/components/ui";
import { STEPS } from "@/lib/pitch";
import Reveal from "./Reveal";

/** Slide 5 (dark): the whole product in three words. */
export default function Approach() {
  return (
    <>
      <div aria-hidden className="absolute inset-0 -z-10">
        <Threads color="#ffffff" accentColor="#ff6e3e" lineCount={60} thickness={0.45} amplitude={1.3} distance={0.5} speed={0.35} angle={-12} taper={0.9} brightness={1} parting={0.5} enableMouseInteraction fade={0.4} opacity={0.3} />
      </div>

      <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col justify-center px-6 py-24 md:px-10 lg:px-16">
        <Reveal depth={0.6}>
          <p className="flex items-center gap-3 font-aeonik-mono text-sm uppercase tracking-[0.15em] text-accent">
            <span className="flex h-7 w-7 items-center justify-center rounded border border-accent text-xs">3</span>
            The solution
          </p>
        </Reveal>
        <Reveal depth={1}>
          <h2 className="mt-6 max-w-5xl font-aeonik text-5xl leading-[0.95] tracking-tight md:text-7xl short:md:text-6xl">
            Seismo watches your APIs <span className="text-accent">so you don&apos;t have to.</span>
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-3 short:mt-10">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} depth={1.4 + i * 0.35}>
              <div className="h-full rounded-xl border border-white/15 bg-white/[0.04] p-8 backdrop-blur-sm transition-colors hover:border-accent/70 hover:bg-white/[0.08]">
                <p className="font-aeonik-mono text-sm text-accent">{s.n}</p>
                <h3 className="mt-6 font-aeonik text-5xl tracking-tight short:text-4xl">{s.title}</h3>
                <p className="mt-4 font-aeonik-light text-lg leading-snug text-white/70">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </>
  );
}
