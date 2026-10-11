import { Threads } from "@/components/ui";
import Logo from "@/components/layout/Logo";
import Reveal from "./Reveal";

/** Slide 8: one more field of threads, the closing line, and the footer pinned to the bottom. */
export default function FinalCta() {
  return (
    <>
      <div aria-hidden className="absolute inset-0 -z-10">
        <Threads color="#1a1918" accentColor="#ff6e3e" lineCount={60} thickness={0.5} amplitude={1.4} distance={0.5} speed={0.4} angle={-20} taper={0.8} brightness={1.1} parting={0.6} enableMouseInteraction fade={0.5} opacity={0.6} />
      </div>
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center px-6 py-24 md:px-10 lg:px-16">
        <Reveal depth={1}>
          <h2 className="max-w-5xl font-aeonik text-5xl leading-[0.92] tracking-tight md:text-7xl xl:text-8xl short:xl:text-7xl">
            Know first. <span className="text-accent">See what breaks.</span> Fix it safely.
          </h2>
        </Reveal>
        <Reveal depth={1.5}>
          <p className="mt-10 font-aeonik text-3xl tracking-tight md:text-5xl">Thank you.</p>
        </Reveal>
      </div>

      <footer className="border-t border-box-outline bg-page-bg/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-6 py-5 md:px-10 lg:px-16">
          <Logo />
          <p className="font-aeonik-mono text-[11px] uppercase tracking-wider text-text-primary/40">Seismo · HackWave 3.0</p>
        </div>
      </footer>
    </>
  );
}
