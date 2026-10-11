import Link from "next/link";
import { Threads } from "@/components/ui";

/** First screen: live threads behind the headline. The threads lean toward the cursor and part around it. */
export default function Hero() {
  return (
    <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10">
        <Threads
          color="#1a1918"
          accentColor="#ff6e3e"
          lineCount={70}
          thickness={0.55}
          softness={1.2}
          amplitude={1.5}
          distance={0.45}
          waves={1.05}
          speed={0.5}
          split={0.04}
          fray={0.5}
          angle={18}
          taper={0.8}
          brightness={1.1}
          parting={0.6}
          enableMouseInteraction
          fade={0.3}
          opacity={0.75}
        />
      </div>

      <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-28 md:px-10 lg:px-16">
        <p className="font-aeonik-mono text-xs uppercase tracking-[0.2em] text-accent">API drift guard</p>
        <h1 className="mt-5 max-w-5xl font-aeonik text-5xl leading-[0.92] tracking-tight md:text-7xl xl:text-[7rem]">
          Your API is up.
          <br />
          Your monitor is green.
          <br />
          Your app is <span className="text-accent">silently wrong.</span>
        </h1>
        <p className="mt-7 max-w-xl font-aeonik-light text-base leading-relaxed text-text-primary/75 md:text-lg">
          Seismo watches the APIs you depend on, catches silent changes in shape, behaviour and meaning, shows which of your code breaks, and opens a safe fix pull request.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link
            href="/login"
            className="rounded-md bg-btn-primary px-6 py-3.5 font-aeonik-mono text-sm uppercase tracking-wider text-white transition-transform hover:scale-[1.03]"
          >
            Install on GitHub
          </Link>
          <a
            href="#demo"
            className="rounded-md border border-text-primary bg-section/70 px-6 py-3.5 font-aeonik-mono text-sm uppercase tracking-wider backdrop-blur-sm transition-colors hover:bg-section"
          >
            Break an API live ↓
          </a>
        </div>
        <p className="mt-6 font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/55">
          Read-only SDK · Fails open · Shapes, never values
        </p>
      </div>
    </section>
  );
}
