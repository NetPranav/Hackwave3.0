import Reveal from "./Reveal";
import SectionLabel from "./SectionLabel";

const STATUS = [
  { label: "API", value: "200 OK", tone: "border-ok/50 bg-ok/10 text-ok" },
  { label: "Monitor", value: "Green", tone: "border-ok/50 bg-ok/10 text-ok" },
  { label: "Checkout", value: "Wrong", tone: "border-accent bg-accent/10 text-accent" },
];

/** Slide 2: the hook. One renamed field, and nothing tells you. Fills the screen: big title, big before/after, big status row. */
export default function Hook() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col justify-center gap-10 px-6 py-24 md:px-10 lg:px-16 short:gap-6 short:py-16">
      <div>
        <Reveal depth={0.6}>
          <SectionLabel n="1" label="One night, one field" />
        </Reveal>
        <Reveal depth={1}>
          <h2 className="mt-6 font-aeonik text-6xl leading-[0.92] tracking-tight md:text-8xl xl:text-[8.5rem] short:xl:text-[6.5rem]">
            One field renamed.
            <br />
            <span className="text-accent">Nobody told you.</span>
          </h2>
        </Reveal>
      </div>

      <Reveal depth={1.5} className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <div className="rounded-2xl border border-box-outline bg-section p-8 short:p-6">
          <p className="font-aeonik-mono text-sm uppercase tracking-[0.2em] text-text-primary/60">Yesterday</p>
          <p className="mt-4 font-aeonik-mono text-3xl md:text-5xl short:md:text-4xl">&quot;amount&quot;: 1000</p>
        </div>
        <span aria-hidden className="flex items-center justify-center font-aeonik-mono text-5xl text-accent md:text-6xl">&rarr;</span>
        <div className="rounded-2xl border-2 border-accent bg-accent/10 p-8 short:p-6">
          <p className="font-aeonik-mono text-sm uppercase tracking-[0.2em] text-accent">Today</p>
          <p className="mt-4 font-aeonik-mono text-3xl text-accent md:text-5xl short:md:text-4xl">&quot;total_amount&quot;: 1000</p>
        </div>
      </Reveal>

      <div className="grid gap-4 md:grid-cols-3">
        {STATUS.map((s, i) => (
          <Reveal key={s.label} depth={1.9 + i * 0.25}>
            <div className={"flex items-center justify-between rounded-2xl border p-6 short:p-4 " + s.tone}>
              <span className="font-aeonik-mono text-sm uppercase tracking-[0.2em] text-text-primary/70">{s.label}</span>
              <span className="font-aeonik text-3xl tracking-tight md:text-4xl">{s.value}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
