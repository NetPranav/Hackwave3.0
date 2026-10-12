import Link from "next/link";
import { Threads } from "@/components/ui";
import DeckLink from "./deck/DeckLink";
import Magnetic from "./Magnetic";
import Reveal from "./Reveal";

/** Slide 1: threads that follow the cursor, behind the headline. */
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

      <div className="mx-auto grid h-full w-full max-w-[1440px] items-center px-6 pb-16 pt-24 md:px-10 lg:px-16">
        <div>
          <Reveal depth={0.6}>
            <p className="font-aeonik-mono text-xs uppercase tracking-[0.2em] text-accent">Dependabot for the APIs you depend on</p>
          </Reveal>
          <Reveal depth={1}>
            <h1 className="mt-6 font-aeonik text-5xl leading-[0.95] tracking-tight md:text-6xl xl:text-[5.5rem] short:xl:text-[4.6rem]">
              Your API is up.
              <br />
              Your monitor is green.
              <br />
              Your app is <span className="text-accent">silently wrong.</span>
            </h1>
          </Reveal>
          <Reveal depth={1.4}>
            <p className="mt-7 max-w-lg font-aeonik-light text-base leading-relaxed text-text-primary/65 md:text-lg">
              Seismo catches silent changes in the APIs you depend on, shows which of your code breaks, and opens a safe fix pull request.
            </p>
          </Reveal>
          <Reveal depth={1.8} className="mt-10 flex flex-wrap items-center gap-5">
            <Magnetic>
              <Link href="/login" className="block rounded-md bg-btn-primary px-6 py-3.5 font-aeonik-mono text-sm uppercase tracking-wider text-white transition-colors hover:bg-accent">
                Install on GitHub
              </Link>
            </Magnetic>
            <DeckLink to="demo" className="group flex items-center gap-2 px-2 py-3.5 font-aeonik-mono text-sm uppercase tracking-wider text-text-primary/70 transition-colors hover:text-accent">
              Watch it break
              <span aria-hidden className="transition-transform group-hover:translate-y-0.5">↓</span>
            </DeckLink>
          </Reveal>
        </div>

      </div>

      <div aria-hidden className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 font-aeonik-mono text-[10px] uppercase tracking-[0.25em] text-text-primary/45 deck:flex">
        Scroll
        <span className="block h-8 w-px animate-pulse bg-text-primary/40" />
      </div>
    </>
  );
}
