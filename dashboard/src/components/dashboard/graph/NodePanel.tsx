"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import { describeNode } from "@/lib/graph/info";
import { plainUsage } from "@/lib/plain";
import { STATE_LABEL, type BuiltGraph, type GraphNode } from "@/lib/graph/types";

const DOT: Record<GraphNode["state"], string> = {
  breaking: "bg-accent",
  suspected: "bg-warn dark:bg-warn-bright",
  fix: "bg-ok dark:bg-ok-bright",
  normal: "bg-text-primary/40 dark:bg-white/40",
};

const LABEL = "font-aeonik-mono text-[10px] uppercase tracking-[0.2em] text-text-primary/45 dark:text-white/40";
const LINK =
  "font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/70 underline-offset-4 transition-colors hover:text-accent hover:underline dark:text-white/70 dark:hover:text-accent";

const EVENT_LINK =
  "font-aeonik text-sm text-text-primary underline-offset-4 transition-colors hover:text-accent hover:underline dark:text-white dark:hover:text-accent";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-box-outline/40 px-5 py-4 dark:border-dark-border/40">
      <h4 className={LABEL}>{title}</h4>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-box-outline/40 bg-inset/40 px-3 py-2.5 dark:border-dark-border/30 dark:bg-dark-inset/40">
      <dt className={LABEL}>{label}</dt>
      <dd className="mt-1">
        <AnimatedNumber value={value} size={22} weight={500} className="font-aeonik text-text-primary dark:text-white" />
      </dd>
    </div>
  );
}

function Overview({ graph, onSelect }: { graph: BuiltGraph; onSelect: (id: string) => void }) {
  const changed = graph.nodes.filter((n) => n.type === "field" && n.state !== "normal");
  const stats: [string, number][] = [
    ["Services", graph.meta.counts.service],
    ["API calls", graph.meta.counts.endpoint],
    ["Code refs", graph.meta.mappedReads],
    ["Features", graph.meta.counts.workflow],
  ];
  return (
    <>
      <div className="px-5 py-5">
        <div className="flex items-center gap-2">
          <p className={LABEL}>Dependency graph</p>
        </div>
        <p className="mt-3 font-aeonik text-lg font-medium leading-snug text-text-primary dark:text-white">
          What do we depend on, and what breaks if it changes?
        </p>
        <p className="mt-2 font-aeonik-light text-xs leading-relaxed text-text-primary/50 dark:text-white/50">
          Click any node to light up its whole path, from the provider to the features that use it.
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-2.5">
          {stats.map(([label, value]) => (
            <StatCard key={label} label={label} value={value} />
          ))}
        </dl>
      </div>
      <Section title="What changed">
        {changed.length === 0 ? (
          <p className="font-aeonik-mono text-xs text-text-primary/40 dark:text-white/40">Nothing has changed yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {changed.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onSelect(n.id)}
                  className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-all duration-150 hover:bg-accent/5 dark:hover:bg-accent/5"
                >
                  <span className={cn("h-2 w-2 shrink-0 rounded-full transition-shadow", DOT[n.state])} />
                  <span className="font-aeonik-mono text-xs text-text-primary transition-colors group-hover:text-accent dark:text-white dark:group-hover:text-accent">{n.label}</span>
                  <span className="ml-auto truncate font-aeonik-mono text-[10px] text-text-primary/40 dark:text-white/35">
                    {graph.nodes.find((p) => p.id === graph.inn.get(n.id)?.[0])?.label ?? n.cluster}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function Detail({ node, graph, onSelect }: { node: GraphNode; graph: BuiltGraph; onSelect: (id: string | null) => void }) {
  const info = describeNode(node, graph);
  return (
    <>
      <div className="flex items-start justify-between gap-3 px-5 py-5">
        <div className="min-w-0">
          <p className={cn(LABEL, "flex items-center gap-2")}>
            <span className={cn("h-2 w-2 rounded-full", DOT[node.state])} />
            {info.kind} · {STATE_LABEL[node.state]}
          </p>
          <h3 className="mt-2 break-words font-aeonik text-xl font-medium tracking-tight text-text-primary dark:text-white">
            {info.title}
          </h3>
          {info.subtitle && (
            <p className="mt-1 break-all font-aeonik-mono text-[11px] text-text-primary/45 dark:text-white/40">{info.subtitle}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-label="Clear selection"
          className="shrink-0 rounded-md border border-box-outline/60 px-2.5 py-1 font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/50 transition-all duration-200 hover:border-accent/40 hover:text-accent dark:border-dark-border/60 dark:text-white/50 dark:hover:border-accent/40 dark:hover:text-accent"
        >
          Esc
        </button>
      </div>

      <Section title="Stats">
        <dl className="space-y-1.5 font-aeonik-mono text-xs">
          {info.rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-text-primary/45 dark:text-white/40">{k}</dt>
              <dd className="text-right text-text-primary dark:text-white">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {info.snippet && (
        <Section title="Code">
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-box-outline/40 bg-inset px-3.5 py-2.5 font-aeonik-mono text-[11px] leading-relaxed text-text-primary/85 dark:border-dark-border/30 dark:bg-dark-inset dark:text-white/85">
            <code>{info.snippet}</code>
          </pre>
        </Section>
      )}

      {info.sites.length > 0 && (
        <Section title="Where it is used">
          <ul className="space-y-3">
            {info.sites.map((s) => (
              <li key={s.file + s.line} className="font-aeonik-mono text-xs">
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-text-primary underline-offset-4 transition-colors hover:text-accent hover:underline dark:text-white dark:hover:text-accent"
                  >
                    {s.file}:{s.line} ↗
                  </a>
                ) : (
                  <span className="font-semibold text-text-primary dark:text-white">
                    {s.file}:{s.line}
                  </span>
                )}
                <p className="mt-0.5 text-[11px] text-text-primary/45 dark:text-white/40">
                  {plainUsage(s.usageKind)} · {s.workflow}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {info.related.length > 0 && (
        <Section title="Comes from">
          <p className="font-aeonik-mono text-xs leading-relaxed text-text-primary/70 dark:text-white/70">{info.related.join(" · ")}</p>
        </Section>
      )}

      {info.events.length > 0 && (
        <Section title="Open changes">
          <ul className="space-y-2">
            {info.events.map((e) => (
              <li key={e.id}>
                <Link href={"/app/drift/" + e.id} className={EVENT_LINK}>
                  {e.title} ↗
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {info.rules.length > 0 && (
        <Section title="Fixes applied">
          <ul className="space-y-2 font-aeonik-mono text-xs text-text-primary/70 dark:text-white/70">
            {info.rules.map((r) => (
              <li key={r.text}>
                <span>
                  {r.text}
                  {r.prNumber ? " · PR #" + r.prNumber : ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {info.links.length > 0 && (
        <Section title="Go to">
          <ul className="space-y-2">
            {info.links.map((l) => (
              <li key={l.href}>
                {l.href.startsWith("http") ? (
                  <a href={l.href} target="_blank" rel="noreferrer" className={LINK}>
                    {l.label} ↗
                  </a>
                ) : (
                  <Link href={l.href} className={LINK}>
                    {l.label} ↗
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

/** Right-hand panel: the overview until you click something, then everything about that node. */
export default function NodePanel({ graph, node, onSelect }: { graph: BuiltGraph; node: GraphNode | null; onSelect: (id: string | null) => void }) {
  return (
    <aside aria-label="Node details" className="h-full overflow-y-auto">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={node?.id ?? "overview"}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {node ? <Detail node={node} graph={graph} onSelect={onSelect} /> : <Overview graph={graph} onSelect={onSelect} />}
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}
