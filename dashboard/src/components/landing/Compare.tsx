"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { COMPARE_COLUMNS, COMPARE_ROWS, type Cell } from "@/lib/landing";
import Reveal from "./Reveal";

const MARK: Record<Cell, { glyph: string; label: string; tone: string }> = {
  yes: { glyph: "●", label: "Yes", tone: "text-white" },
  partial: { glyph: "◐", label: "Partly", tone: "text-white/60" },
  no: { glyph: "–", label: "Not found", tone: "text-white/25" },
};

const SEISMO = COMPARE_COLUMNS.length - 1;
const differs = (cells: Cell[]) => cells.slice(0, SEISMO).filter((c) => c === "yes").length <= 1;

/** Slide 9 (dark): what other kinds of tools do, per their public material. Hover a column; filter to the differences. */
export default function Compare() {
  const [col, setCol] = useState<number | null>(null);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const rows = onlyDiff ? COMPARE_ROWS.filter((r) => differs(r.cells)) : COMPARE_ROWS;

  const cellTone = (i: number) => (col === null || col === i ? "" : "opacity-30");

  return (
    <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col justify-center px-6 py-24 md:px-10 lg:px-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Reveal depth={0.6}>
            <p className="flex items-center gap-3 font-aeonik-mono text-sm uppercase tracking-[0.15em] text-accent">
              <span className="flex h-7 w-7 items-center justify-center rounded border border-accent text-xs">7</span>
              Compare
            </p>
          </Reveal>
          <Reveal depth={1}>
            <h2 className="mt-6 max-w-3xl font-aeonik text-4xl leading-[0.98] tracking-tight md:text-5xl">Others watch the shape. We watch the meaning, and your code.</h2>
          </Reveal>
        </div>
        <Reveal depth={1.2}>
          <button
            type="button"
            onClick={() => setOnlyDiff((v) => !v)}
            aria-pressed={onlyDiff}
            className={cn(
              "rounded-md border px-4 py-2 font-aeonik-mono text-xs uppercase tracking-wider transition-colors",
              onlyDiff ? "border-accent bg-accent text-white" : "border-white/25 text-white/75 hover:border-white"
            )}
          >
            {onlyDiff ? "Show every row" : "Show only where we differ"}
          </button>
        </Reveal>
      </div>

      <Reveal depth={1.8} className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left" onPointerLeave={() => setCol(null)}>
          <thead>
            <tr>
              <th className="border-b border-white/15 pb-3 pr-4 font-aeonik-mono text-[11px] font-normal uppercase tracking-[0.2em] text-white/45">Capability</th>
              {COMPARE_COLUMNS.map((c, i) => (
                <th
                  key={c}
                  onPointerEnter={() => setCol(i)}
                  className={cn(
                    "cursor-default border-b px-3 pb-3 text-center font-aeonik text-sm font-normal transition-opacity",
                    i === SEISMO ? "border-accent bg-accent/10 text-accent" : "border-white/15 text-white/75",
                    cellTone(i)
                  )}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="group">
                <th className="border-b border-white/10 py-3 pr-4 font-aeonik text-sm font-normal text-white/85 transition-colors group-hover:text-white short:py-2.5">{row.label}</th>
                {row.cells.map((cell, i) => (
                  <td
                    key={i}
                    className={cn(
                      "border-b px-3 py-3 text-center text-lg transition-all short:py-2.5",
                      i === SEISMO ? "border-accent/30 bg-accent/10 text-accent" : cn("border-white/10 group-hover:bg-white/[0.04]", MARK[cell].tone),
                      cellTone(i)
                    )}
                  >
                    <span aria-hidden>{MARK[cell].glyph}</span>
                    <span className="sr-only">{MARK[cell].label}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
      <Reveal depth={2.2}>
        <p className="mt-5 max-w-4xl font-aeonik-light text-sm leading-relaxed text-white/55">
          ● yes · ◐ partly · – not found. Other tools are our reading of their public material and may be out of date. We do not claim to be first. Pollers need no install at all; we need one SDK line, because real traffic is what shows meaning and your code.
        </p>
      </Reveal>
    </div>
  );
}
