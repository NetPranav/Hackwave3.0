import Link from "next/link";
import { Threads } from "@/components/ui";
import DeckLink from "./deck/DeckLink";
import Float from "./Float";
import HeroAlerts from "./HeroAlerts";
import Magnetic from "./Magnetic";
import Reveal from "./Reveal";

/** Slide 1: threads that follow the cursor, the headline, and a live-looking alert card that drifts with the mouse. */
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

      <div className="mx-auto grid h-full w-full max-w-[1440px] items-center gap-10 px-6 pb-16 pt-24 md:px-10 lg:grid-cols-[1fr_auto] lg:px-16">
        <div>
          <Reveal depth={0.6}>
            <p className="font-aeonik-mono text-xs uppercase tracking-[0.2em] text-accent">Dependabot for the APIs you depend on</p>
          </Reveal>
          <Reveal depth={1}>
            <h1 className="mt-5 font-aeonik text-5xl leading-[0.92] tracking-tight md:text-7xl xl:text-[6.5rem] short:xl:text-[5.25rem]">
              Your API is up.
              <br />
              Your monitor is green.
              <br />
              Your app is <span className="text-accent">silently wrong.</span>
            </h1>
          </Reveal>
          <Reveal depth={1.4}>
            <p className="mt-7 max-w-xl font-aeonik-light text-base leading-relaxed text-text-primary/75 md:text-lg">
              Seismo catches silent changes in the APIs you depend on, shows which of your code breaks, and opens a safe fix pull request.
            </p>
          </Reveal>
          <Reveal depth={1.8} className="mt-9 flex flex-wrap items-center gap-3">
            <Magnetic>
              <Link href="/login" className="block rounded-md bg-btn-primary px-6 py-3.5 font-aeonik-mono text-sm uppercase tracking-wider text-white transition-colors hover:bg-accent">
                Install on GitHub
              </Link>
            </Magnetic>
            <Magnetic>
              <DeckLink to="demo" className="block rounded-md border border-text-primary bg-section/70 px-6 py-3.5 font-aeonik-mono text-sm uppercase tracking-wider backdrop-blur-sm transition-colors hover:bg-section">
                Break an API live ↓
              </DeckLink>
            </Magnetic>
          </Reveal>
        </div>

        <Reveal depth={2.4} className="hidden lg:block">
          <Float strength={-22}>
            <HeroAlerts />
          </Float>
        </Reveal>
      </div>

      <div aria-hidden className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 font-aeonik-mono text-[10px] uppercase tracking-[0.25em] text-text-primary/45 deck:flex">
        Scroll
        <span className="block h-8 w-px animate-pulse bg-text-primary/40" />
      </div>
    </>
  );
}
