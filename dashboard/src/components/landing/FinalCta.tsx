import Link from "next/link";
import { Threads } from "@/components/ui";
import Logo from "@/components/layout/Logo";
import Magnetic from "./Magnetic";
import Reveal from "./Reveal";

/** Slide 11: one more field of threads, the closing line, two buttons, and the footer pinned to the bottom. */
export default function FinalCta() {
  return (
    <>
      <div aria-hidden className="absolute inset-0 -z-10">
        <Threads color="#1a1918" accentColor="#ff6e3e" lineCount={60} thickness={0.5} amplitude={1.4} distance={0.5} speed={0.4} angle={-20} taper={0.8} brightness={1.1} parting={0.6} enableMouseInteraction fade={0.5} opacity={0.6} />
      </div>
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center px-6 py-24 md:px-10 lg:px-16">
        <Reveal depth={1}>
          <h2 className="max-w-5xl font-aeonik text-5xl leading-[0.92] tracking-tight md:text-7xl xl:text-8xl short:xl:text-7xl">
            Know when your APIs change. <span className="text-accent">Before your users do.</span>
          </h2>
        </Reveal>
        <Reveal depth={1.4}>
          <p className="mt-6 max-w-xl font-aeonik-light text-base leading-relaxed text-text-primary/75 md:text-lg">
            Install the GitHub App, add one line, and see your first dependency map in minutes.
          </p>
        </Reveal>
        <Reveal depth={1.8} className="mt-9 flex flex-wrap gap-3">
          <Magnetic>
            <Link href="/login" className="block rounded-md bg-btn-primary px-6 py-3.5 font-aeonik-mono text-sm uppercase tracking-wider text-white transition-colors hover:bg-accent">
              Install on GitHub
            </Link>
          </Magnetic>
          <Magnetic>
            <Link href="/login" className="block rounded-md border border-text-primary bg-section/70 px-6 py-3.5 font-aeonik-mono text-sm uppercase tracking-wider backdrop-blur-sm transition-colors hover:bg-section">
              Sign in with GitHub
            </Link>
          </Magnetic>
        </Reveal>
      </div>

      <footer className="border-t border-box-outline bg-page-bg/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-6 py-5 md:px-10 lg:px-16">
          <Logo />
          <nav aria-label="Footer" className="flex flex-wrap gap-5 font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/60">
            <Link href="/docs/sdk" className="hover:text-accent">Docs</Link>
            <a href="https://github.com/NetPranav/Hackwave3.0" target="_blank" rel="noopener noreferrer" className="hover:text-accent">GitHub</a>
            <Link href="/app" className="hover:text-accent">Dashboard</Link>
          </nav>
          <p className="font-aeonik-mono text-[11px] uppercase tracking-wider text-text-primary/40">Seismo · HackWave 3.0</p>
        </div>
      </footer>
    </>
  );
}
