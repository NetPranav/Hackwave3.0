"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Card } from "@/components/dashboard/Card";
import { buildGraph, pathOf } from "@/lib/graph/build";
import { COLUMNS } from "@/lib/graph/sankey";
import { layoutFlow } from "@/lib/graph/sankey";
import FlowGraph from "./FlowGraph";
import GraphToolbar, { type SeverityFilter } from "./GraphToolbar";
import { Headline, Legend, PathSummary, PathTrail } from "./GraphOverlays";
import HoverCard from "./HoverCard";
import NodePanel from "./NodePanel";

const MIN_WIDTH = 1040;
/** Draw a little smaller than the screen, leaving space around the picture. */
const ZOOM = 0.88;

/** The dependency map: what we depend on, what changed, and how far each change reaches. */
export default function GraphView({ highlight }: { highlight?: string }) {
  const reduceMotion = useReducedMotion() ?? false;
  const [graph] = useState(buildGraph);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const [selectedId, setSelectedId] = useState<string | null>(() =>
    highlight && graph.nodes.some((n) => n.id === "svc:" + highlight) ? "svc:" + highlight : null
  );
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  /** Double-click isolates one node's path; everything else leaves and the rest re-centres. */
  const [isolateId, setIsolateId] = useState<string | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: Math.floor(entry.contentRect.width), h: Math.floor(entry.contentRect.height) })
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSelectedId(null);
      setIsolateId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);

  const isolated = useMemo(() => (isolateId ? pathOf(isolateId, graph) : null), [isolateId, graph]);

  const visible = useMemo(() => {
    const set = new Set<string>();
    for (const n of graph.nodes) {
      if (n.unused) continue;
      if (isolated && !isolated.has(n.id)) continue;
      if (severity !== "all" && n.state !== severity) continue;
      set.add(n.id);
    }
    return set;
  }, [graph, severity, isolated]);

  const selected = selectedId && visible.has(selectedId) ? (nodeById.get(selectedId) ?? null) : null;

  // Highlighted path: the selection wins; otherwise whatever is under the pointer.
  const focusSet = useMemo(() => {
    const id = selected?.id ?? hoverId;
    return id && visible.has(id) ? pathOf(id, graph) : null;
  }, [selected, hoverId, visible, graph]);

  const width = Math.max(Math.min(size.w, 1440) - (size.w >= 1024 ? 128 : 48), MIN_WIDTH);
  const layout = useMemo(() => layoutFlow(graph, visible, width, size.h), [graph, visible, width, size.h]);

  const headline = useMemo(
    () => ({
      changedFields: graph.nodes.filter((n) => n.type === "field" && n.state !== "normal").length,
      featuresAtRisk: graph.nodes.filter((n) => n.type === "workflow" && n.state !== "normal").length,
      untraced: graph.meta.unresolvedReads,
    }),
    [graph]
  );

  const pathSummary = useMemo(() => {
    if (!selected || !focusSet) return null;
    const count = { service: 0, endpoint: 0, field: 0, code: 0, workflow: 0 };
    for (const id of focusSet) {
      const n = nodeById.get(id);
      if (n) count[n.type] += 1;
    }
    return count;
  }, [selected, focusSet, nodeById]);

  const hoverTrail = useMemo(() => {
    if (!hoverId || selected || !focusSet) return null;
    const stages: string[][] = COLUMNS.map(() => []);
    for (const id of focusSet) {
      const n = nodeById.get(id);
      if (n) stages[COLUMNS.indexOf(n.type)].push(n.label);
    }
    return stages;
  }, [hoverId, selected, focusSet, nodeById]);

  const panelOpen = selected !== null;
  const fade = (delay: number, from: "top" | "bottom") => ({
    initial: reduceMotion ? false : { opacity: 0, y: from === "top" ? -8 : 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <main className="relative h-[calc(100dvh-45px)] min-h-[560px] w-full overflow-hidden bg-section [--flow-halo:var(--color-section)] dark:bg-dark-dash-section dark:[--flow-halo:var(--color-dark-dash-section)]">

      {/* The diagram. Narrow screens scroll sideways instead of squashing the columns. */}
      <div
        ref={wrapRef}
        role="img"
        aria-label={"Dependency map with " + graph.nodes.length + " items. Open the list to browse them."}
        className="absolute inset-0 overflow-x-auto overflow-y-hidden"
      >
        {size.w > 0 && (
          <FlowGraph
            layout={layout}
            width={width}
            height={size.h}
            selectedId={selected?.id ?? null}
            hoverId={hoverId}
            focusSet={focusSet}
            reduceMotion={reduceMotion}
            zoom={ZOOM}
            onSelect={setSelectedId}
            onIsolate={(id) => {
              setIsolateId(id);
              setSelectedId(null);
            }}
            onHover={setHoverId}
          />
        )}
      </div>
      <HoverCard node={hoverId ? (nodeById.get(hoverId) ?? null) : null} graph={graph} containerRef={wrapRef} />

      {/* Everything floating sits in the same 1440px column as the top nav, so the edges line up with its logo and buttons. */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-full max-w-[1440px] -translate-x-1/2">
        <motion.div
          className="pointer-events-auto absolute inset-x-6 top-4 z-10 flex flex-wrap items-center justify-between gap-3 md:inset-x-10 lg:inset-x-16"
          {...fade(0.1, "top")}
        >
          <GraphToolbar
            severity={severity}
            onSeverityChange={setSeverity}
          />
          <div className="flex flex-wrap items-center gap-3">
            {isolateId && (
              <button
                type="button"
                onClick={() => setIsolateId(null)}
                className="rounded border border-accent/40 bg-section px-3 py-2 font-aeonik-mono text-[11px] uppercase tracking-wider text-accent dark:bg-dark-dash-section"
              >
                One path only · Show all
              </button>
            )}
            <Headline stats={headline} />
          </div>
        </motion.div>

        {/* Bottom bar: the colour key (or the selected path) on the left, how to use it on the right. */}
        <motion.div className="absolute bottom-4 left-6 z-10 md:left-10 lg:left-16" {...fade(0.3, "bottom")}>
          {hoverTrail ? <PathTrail stages={hoverTrail} /> : pathSummary ? <PathSummary parts={pathSummary} /> : <Legend />}
        </motion.div>
        {!panelOpen && (
          <motion.p
            className="absolute bottom-4 right-6 z-10 hidden items-center rounded border border-box-outline/60 bg-section/90 px-3 py-2 font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/50 md:flex md:right-10 lg:right-16 dark:border-dark-border dark:bg-dark-dash-section/90 dark:text-white/45"
            {...fade(0.35, "bottom")}
          >
            Hover to trace · Click for details · Esc to clear
          </motion.p>
        )}

        <AnimatePresence>
          {panelOpen && (
            <motion.div
              key="panel"
              initial={reduceMotion ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto absolute bottom-16 right-6 top-[76px] z-20 w-[340px] max-w-[calc(100%-3rem)] md:right-10 lg:right-16"
            >
              <Card className="h-full">
                <NodePanel graph={graph} node={selected} onSelect={setSelectedId} />
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
