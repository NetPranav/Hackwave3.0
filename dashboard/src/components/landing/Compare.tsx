import { cn } from "@/lib/utils";
import { COMPARE_COLUMNS, COMPARE_ROWS, type Cell } from "@/lib/landing";
import Reveal from "./Reveal";

const MARK: Record<Cell, { glyph: string; label: string; tone: string }> = {
  yes: { glyph: "●", label: "Yes", tone: "text-white" },
  partial: { glyph: "◐", label: "Partly", tone: "text-white/60" },
  no: { glyph: "–", label: "Not found", tone: "text-white/25" },
};

const SEISMO = COMPARE_COLUMNS.length - 1;

/** Dark comparison table with our column picked out in orange. */
export default function Compare() {
  return (
    <section id="compare" className="px-3 pb-24 md:px-6">
      <div className="mx-auto max-w-[1440px] rounded-xl bg-btn-primary px-6 py-14 text-white md:px-12 md:py-20">
        <Reveal>
          <p className="flex items-center gap-3 font-aeonik-mono text-sm uppercase tracking-[0.15em] text-accent">
            <span className="flex h-7 w-7 items-center justify-center rounded border border-accent text-xs">6</span>
            Compare
          </p>
          <h2 className="mt-6 max-w-4xl font-aeonik text-4xl leading-[0.98] tracking-tight md:text-6xl">Others watch the shape. We watch the meaning, and your code.</h2>
          <p className="mt-4 max-w-2xl font-aeonik-light text-base leading-relaxed text-white/65">
            Polling drift monitors for third-party APIs already exist and are cheap. We do not claim to be first. We combine things we did not find together in one tool.
          </p>
        </Reveal>

        <Reveal className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr>
                <th className="border-b border-white/15 pb-4 pr-4 font-aeonik-mono text-[11px] font-normal uppercase tracking-[0.2em] text-white/45">Capability</th>
                {COMPARE_COLUMNS.map((c, i) => (
                  <th
                    key={c}
                    className={cn(
                      "border-b px-3 pb-4 text-center font-aeonik text-sm font-normal",
                      i === SEISMO ? "border-accent bg-accent/10 text-accent" : "border-white/15 text-white/70"
                    )}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.label} className="group">
                  <th className="border-b border-white/10 py-3.5 pr-4 font-aeonik text-sm font-normal text-white/85 transition-colors group-hover:text-white">{row.label}</th>
                  {row.cells.map((cell, i) => (
                    <td
                      key={i}
                      className={cn(
                        "border-b px-3 py-3.5 text-center text-lg transition-colors",
                        i === SEISMO ? "border-accent/30 bg-accent/10 text-accent" : cn("border-white/10 group-hover:bg-white/[0.03]", MARK[cell].tone)
                      )}
                    >
                      <span aria-hidden>{MARK[cell].glyph}</span>
                      <span className="sr-only">{MARK[cell].label}</span>
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th className="py-3.5 pr-4 font-aeonik text-sm font-normal text-white/85">Zero install in the app</th>
                {(["yes", "yes", "no", "partial"] as Cell[]).map((c, i) => (
                  <td key={i} className={cn("px-3 py-3.5 text-center text-lg", MARK[c].tone)}>
                    <span aria-hidden>{MARK[c].glyph}</span>
                    <span className="sr-only">{MARK[c].label}</span>
                  </td>
                ))}
                <td className="bg-accent/10 px-3 py-3.5 text-center font-aeonik-mono text-[11px] uppercase tracking-wider text-accent">One-line SDK</td>
              </tr>
            </tbody>
          </table>
        </Reveal>
        <p className="mt-6 max-w-3xl font-aeonik-light text-sm leading-relaxed text-white/55">
          ● yes · ◐ partly · – not found. Other tools are our reading of their public material and may be out of date. Pollers need no install at all; we need one SDK line, because real traffic is what lets us see meaning and your code.
        </p>
      </div>
    </section>
  );
}
