"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export type CaseId = "old" | "new" | "both" | "hostile" | "broken";

interface Line {
  text: string;
  added?: boolean;
}

/** Fixed examples of what the alias rule does. Illustration of applyAliases, computed by hand, not a live run. */
export const CASES: { id: CaseId; label: string; rule: string; input: Line[]; output: Line[]; guarantee: string; say: string }[] = [
  {
    id: "old",
    label: "Old shape",
    rule: "customer_id ← customerId",
    input: [{ text: '"customer_id": "c_204"' }, { text: '"amount": 1000' }],
    output: [{ text: '"customer_id": "c_204"' }, { text: '"amount": 1000' }],
    guarantee: "G1",
    say: "Nothing to fix, so nothing changes. Exactly the same object comes back.",
  },
  {
    id: "new",
    label: "New shape",
    rule: "customer_id ← customerId",
    input: [{ text: '"customerId": "c_204"' }, { text: '"amount": 1000' }],
    output: [{ text: '"customerId": "c_204"' }, { text: '"amount": 1000' }, { text: '"customer_id": "c_204"', added: true }],
    guarantee: "G2",
    say: "The old name is added back. Every original field is still there, unchanged.",
  },
  {
    id: "both",
    label: "Both present",
    rule: "customer_id ← customerId",
    input: [{ text: '"customer_id": "c_old"' }, { text: '"customerId": "c_new"' }],
    output: [{ text: '"customer_id": "c_old"' }, { text: '"customerId": "c_new"' }],
    guarantee: "G2",
    say: "The old field wins. The rule only fills a gap, it never overwrites.",
  },
  {
    id: "hostile",
    label: "Hostile rule",
    rule: "__proto__ ← customerId",
    input: [{ text: '"customerId": "c_204"' }],
    output: [{ text: '"customerId": "c_204"' }],
    guarantee: "G3",
    say: "Unsafe names are refused before they can touch anything.",
  },
  {
    id: "broken",
    label: "Broken input",
    rule: "customer_id ← customerId",
    input: [{ text: "<circular object>" }],
    output: [{ text: "<same object, returned as is>" }],
    guarantee: "G4",
    say: "Errors are caught. Your app gets its input back and keeps running.",
  },
];

function Block({ title, lines }: { title: string; lines: Line[] }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="font-aeonik-mono text-[10px] uppercase tracking-[0.2em] text-text-primary/45">{title}</p>
      <pre className="mt-2 min-h-[118px] overflow-hidden rounded-md border border-box-outline bg-inset p-3 font-aeonik-mono text-[12px] leading-relaxed">
        {lines.map((l) => (
          <motion.span
            key={l.text}
            layout
            initial={l.added ? { opacity: 0, x: -10 } : false}
            animate={{ opacity: 1, x: 0 }}
            className={cn("block truncate", l.added && "bg-ok/10 text-ok")}
          >
            {l.added ? "+ " : "  "}
            {l.text}
          </motion.span>
        ))}
      </pre>
    </div>
  );
}

/** Pick a case and see the input, the rule and the output side by side. */
export default function AliasPlayground({ value, onChange }: { value: CaseId; onChange: (id: CaseId) => void }) {
  const c = CASES.find((x) => x.id === value) ?? CASES[0];
  return (
    <div className="rounded-xl border border-box-outline bg-section p-5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Try a case">
        {CASES.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => onChange(x.id)}
            aria-pressed={x.id === value}
            className={cn(
              "rounded px-3 py-1.5 font-aeonik-mono text-[11px] uppercase tracking-wider transition-colors",
              x.id === value ? "bg-btn-primary text-white" : "bg-inset text-text-primary/60 hover:text-text-primary"
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <p className="mt-4 font-aeonik-mono text-xs text-text-primary/60">
        rule: <span className={cn(c.id === "hostile" ? "text-accent line-through" : "text-text-primary")}>{c.rule}</span>
      </p>
      <div className="mt-3 flex items-stretch gap-3">
        <Block title="Response in" lines={c.input} />
        <span aria-hidden className="self-center font-aeonik-mono text-accent">→</span>
        <Block title="Your app gets" lines={c.output} />
      </div>
      <AnimatePresence mode="wait">
        <motion.p key={c.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="mt-4 font-aeonik text-base leading-snug">
          <span className="mr-2 font-aeonik-mono text-xs text-accent">{c.guarantee}</span>
          {c.say}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
