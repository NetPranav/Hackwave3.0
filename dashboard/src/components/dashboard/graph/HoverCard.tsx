"use client";

import { useEffect, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { describeNode } from "@/lib/graph/info";
import { STATE_LABEL, type BuiltGraph, type GraphNode } from "@/lib/graph/types";

const DOT: Record<GraphNode["state"], string> = {
  breaking: "bg-accent",
  suspected: "bg-warn dark:bg-warn-bright",
  fix: "bg-ok dark:bg-ok-bright",
  normal: "bg-text-primary/40 dark:bg-white/40",
};

/** Live stats for the node under the pointer. It tracks the mouse on its own, so moving it never re-renders the graph. */
export default function HoverCard({
  node,
  graph,
  containerRef,
}: {
  node: GraphNode | null;
  graph: BuiltGraph;
  containerRef: RefObject<HTMLElement | null>;
}) {
  const [pos, setPos] = useState({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      setPos({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height });
    };
    el.addEventListener("pointermove", move);
    return () => el.removeEventListener("pointermove", move);
  }, [containerRef]);

  if (!node) return null;
  const info = describeNode(node, graph);
  const flipX = pos.x > pos.w - 260;
  const flipY = pos.y > pos.h - 190;

  return (
    <div
      role="tooltip"
      style={{ left: pos.x, top: pos.y }}
      className={cn(
        "pointer-events-none absolute z-30 w-64 rounded-lg border border-box-outline/60 bg-section/95 p-4 shadow-xl backdrop-blur-md dark:border-dark-border/60 dark:bg-dark-dash-section/95 dark:shadow-black/30",
        flipX ? "-translate-x-[calc(100%+14px)]" : "translate-x-[18px]",
        flipY ? "-translate-y-[calc(100%+10px)]" : "translate-y-[36px]"
      )}
    >
      <div className="flex items-center justify-between gap-2 font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/50 dark:text-white/45">
        <span>{info.kind}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", DOT[node.state])} />
          {STATE_LABEL[node.state]}
        </span>
      </div>
      <p className="mt-1.5 font-aeonik text-sm font-medium text-text-primary dark:text-white">{info.title}</p>
      {info.subtitle && <p className="mt-0.5 font-aeonik-mono text-[11px] text-text-primary/50 dark:text-white/45">{info.subtitle}</p>}
      <dl className="mt-3 space-y-1 border-t border-box-outline/40 pt-2.5 font-aeonik-mono text-[11px] dark:border-dark-border/40">
        {info.rows.slice(1, 4).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-text-primary/45 dark:text-white/40">{k}</dt>
            <dd className="text-right text-text-primary dark:text-white">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 font-aeonik-mono text-[10px] text-accent/70">
        Click to trace the path
      </p>
    </div>
  );
}
