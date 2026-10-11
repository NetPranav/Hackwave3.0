import { Threads } from "@/components/ui";
import Reveal from "./Reveal";

/** Slide 1: the title slide. Event line on top, name and tagline in the middle, team and track at the bottom. */
export default function Hero() {
  return (
    <>
      <div aria-hidden className="absolute inset-0 -z-10">
        <Threads
          color="#1a1918"
          accentColor="#ff6e3e"
          lineCount={70}
          thickness={0.55}
          softness={1.2}
          amplitude={1.5}
          distance={0.45}
          speed={0.5}
          angle={18}
          taper={0.8}
          brightness={1.1}
          parting={0.6}
          enableMouseInteraction
          fade={0.3}
          opacity={0.7}
        />
      </div>

      <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col justify-between px-6 pb-10 pt-8 md:px-10 lg:px-16">
        <Reveal depth={0.4} className="flex items-center justify-between border-b border-text-primary/15 pb-4 font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/60 md:text-xs">
          <span>HackWave 3.0</span>
          <span className="hidden sm:block">PS 3 &middot; The Internet After the API</span>
        </Reveal>

        <div>
          <Reveal depth={0.8}>
            <p className="font-aeonik-mono text-xs uppercase tracking-[0.3em] text-accent md:text-sm">Introducing</p>
          </Reveal>
          <Reveal depth={1.1}>
            <h1 className="mt-4 font-aeonik text-8xl leading-[0.85] tracking-tight md:text-[12rem] xl:text-[15rem] short:xl:text-[11rem]">Seismo</h1>
          </Reveal>
          <Reveal depth={1.5}>
            <p className="mt-8 max-w-3xl font-aeonik text-2xl leading-tight tracking-tight md:text-4xl short:md:text-3xl">
              Dependabot for the <span className="text-accent">APIs you depend on.</span>
            </p>
          </Reveal>
        </div>

        <Reveal depth={0.6} className="flex items-end justify-between border-t border-text-primary/15 pt-4">
          <p className="font-aeonik-mono text-xs uppercase tracking-[0.3em] text-text-primary/60 md:text-sm">
            Team <span className="ml-2 rounded border border-accent bg-accent px-3 py-1.5 text-white">XERO</span>
          </p>
          <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/60 md:text-xs">Track &middot; Resilient Infrastructure</p>
        </Reveal>
      </div>
    </>
  );
}
