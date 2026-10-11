import CountUp from "./CountUp";
import Reveal from "./Reveal";

const CELLS = [
  { big: <><CountUp value={1970} /><span className="text-white/40"> / 3,075</span></>, title: "Web APIs", text: "did not always flag breaking changes.", tag: "Confirmed", source: "ICWE 2024" },
  { big: <><span className="text-white/40">500 &rarr; </span><CountUp value={100} /></>, title: "Pipedrive", text: "Limit cut. No error.", tag: "Confirmed", source: "Changelog, Jan 2025" },
  { big: <>= <span className="text-white/40">&rarr;</span> &asymp;</>, title: "Jira Cloud", text: "Same search, different results.", tag: "Confirmed", source: "Announced change, Oct 2026" },
];

/** Slide 3 (dark): three facts, each with its evidence label. Numbers count up when the slide arrives. */
export default function Evidence() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col justify-center px-6 py-24 md:px-10 lg:px-16">
      <Reveal depth={0.6}>
        <p className="font-aeonik-mono text-sm uppercase tracking-[0.15em] text-accent">It keeps happening</p>
      </Reveal>
      <Reveal depth={1}>
        <h2 className="mt-6 max-w-4xl font-aeonik text-5xl leading-[0.95] tracking-tight md:text-7xl short:md:text-6xl">APIs change. Quietly.</h2>
      </Reveal>

      <div className="mt-14 grid border-y border-white/15 sm:grid-cols-3 short:mt-10">
        {CELLS.map((c, i) => (
          <Reveal key={c.title} depth={1.4 + i * 0.3} className="group relative border-white/15 p-8 transition-colors duration-300 hover:bg-accent [&:not(:last-child)]:sm:border-r">
            <p className="font-aeonik-mono text-xs uppercase tracking-[0.2em] text-white/50 group-hover:text-white/80">{c.title}</p>
            <p className="mt-5 whitespace-nowrap font-aeonik-mono text-5xl tracking-tight xl:text-6xl short:text-4xl short:xl:text-5xl">{c.big}</p>
            <p className="mt-5 font-aeonik text-xl leading-snug text-white/80 group-hover:text-white">{c.text}</p>
            <p className="mt-6 font-aeonik-mono text-[10px] uppercase tracking-wider text-white/40 group-hover:text-white">
              <span className="rounded border border-current px-1.5 py-0.5">{c.tag}</span> &middot; {c.source}
            </p>
          </Reveal>
        ))}
      </div>
      <Reveal depth={2.6}>
        <p className="mt-10 font-aeonik text-2xl tracking-tight text-white/90 md:text-3xl">Libraries have Dependabot. <span className="text-accent">API behaviour has nothing.</span></p>
      </Reveal>
    </div>
  );
}
