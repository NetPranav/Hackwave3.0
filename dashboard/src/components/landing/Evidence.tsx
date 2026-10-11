import CountUp from "./CountUp";
import Reveal from "./Reveal";

const CELLS = [
  { big: <><CountUp value={1970} /><span className="text-white/40"> / 3,075</span></>, title: "Web APIs", text: "did not always flag breaking changes in minor or patch releases.", tag: "Confirmed", source: "ICWE 2024" },
  { big: <><span className="text-white/40">500 → </span><CountUp value={100} /></>, title: "Pipedrive", text: "From 15 Jan 2025 a request for 500 items returns at most 100. No error.", tag: "Confirmed", source: "Changelog" },
  { big: <><CountUp value={1000} /><span className="text-white/40"> max</span></>, title: "Lightspeed", text: "Since Feb 2020, larger requests quietly return the first 1,000.", tag: "Confirmed", source: "Changelog" },
  { big: <>= <span className="text-white/40">→</span> ≈</>, title: "Jira Cloud", text: "6 Oct 2026: text = now matches any text containing the phrase.", tag: "Confirmed", source: "Announced, not an incident" },
  { big: <><span className="text-white/40">84 → </span><CountUp value={51} />%</>, title: "Same model name", text: "Different behaviour on one benchmark, Mar to Jun 2023.", tag: "Peer-reviewed", source: "HDSR 2024" },
];

/** Slide 3 (dark): five facts, each with its evidence label. Numbers count up when the slide arrives. */
export default function Evidence() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col justify-center px-6 py-24 md:px-10 lg:px-16">
      <Reveal depth={0.6}>
        <p className="font-aeonik-mono text-sm uppercase tracking-[0.15em] text-accent">In writing, not in your code</p>
      </Reveal>
      <Reveal depth={1}>
        <h2 className="mt-6 max-w-4xl font-aeonik text-4xl leading-[0.98] tracking-tight md:text-6xl short:md:text-5xl">This keeps happening. Quietly.</h2>
      </Reveal>

      <div className="mt-14 grid border-y border-white/15 sm:grid-cols-2 lg:grid-cols-5 short:mt-10">
        {CELLS.map((c, i) => (
          <Reveal key={c.title} depth={1.4 + i * 0.25} className="group relative border-white/15 p-6 transition-colors duration-300 hover:bg-accent [&:not(:last-child)]:lg:border-r">
            <p className="font-aeonik-mono text-[10px] uppercase tracking-[0.2em] text-white/50 group-hover:text-white/80">{c.title}</p>
            <p className="mt-4 whitespace-nowrap font-aeonik-mono text-3xl tracking-tight xl:text-4xl short:text-2xl short:xl:text-3xl">{c.big}</p>
            <p className="mt-4 font-aeonik-light text-sm leading-relaxed text-white/65 group-hover:text-white">{c.text}</p>
            <p className="mt-5 font-aeonik-mono text-[10px] uppercase tracking-wider text-white/40 group-hover:text-white">
              <span className="rounded border border-current px-1.5 py-0.5">{c.tag}</span> · {c.source}
            </p>
          </Reveal>
        ))}
      </div>
      <Reveal depth={2.6}>
        <p className="mt-6 font-aeonik-light text-sm text-white/50">Nobody has measured what silent API drift costs. We say unmeasured, and do not invent a number.</p>
      </Reveal>
    </div>
  );
}
