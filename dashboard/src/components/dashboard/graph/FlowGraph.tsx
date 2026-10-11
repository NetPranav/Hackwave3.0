"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { COLUMNS, COLUMN_TITLE, type FlowLayout } from "@/lib/graph/sankey";
import type { GraphNode, GraphState } from "@/lib/graph/types";

/** Text colour per state: the bars and ribbons use `currentColor`, so the theme and dark mode come for free. */
const TONE: Record<GraphState, string> = {
  breaking: "text-accent",
  suspected: "text-warn dark:text-warn-bright",
  fix: "text-ok dark:text-ok-bright",
  normal: "text-text-primary dark:text-white",
};

const EASE = [0.16, 1, 0.3, 1] as const;
const LABEL_MAX = 28;

interface FlowGraphProps {
  layout: FlowLayout;
  width: number;
  height: number;
  selectedId: string | null;
  hoverId: string | null;
  /** Highlighted path: the selected node's, or the hovered node's. Null means nothing is highlighted. */
  focusSet: Set<string> | null;
  reduceMotion: boolean;
  /** The picture is drawn this much smaller than the screen, so there is breathing room around it. */
  zoom: number;
  onSelect: (id: string | null) => void;
  /** Double-click: show only this node's path. */
  onIsolate: (id: string) => void;
  onHover: (id: string | null) => void;
}

function labelOf(node: GraphNode): string {
  return node.label.length > LABEL_MAX ? node.label.slice(0, LABEL_MAX - 1) + "…" : node.label;
}

/** The flow diagram: bars for things, ribbons for what flows between them. All SVG, so it stays sharp and every shape is a real element. */
export default function FlowGraph(p: FlowGraphProps) {
  const { layout, focusSet, reduceMotion } = p;

  // The first arrival is staggered column by column; after that, changes are quick.
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setArrived(true), 1400);
    return () => window.clearTimeout(t);
  }, []);
  const intro = !reduceMotion && !arrived;
  // Bars appear first, column by column; each line then draws itself from its start to its end.
  const barMotion = (col: number) => ({ duration: reduceMotion ? 0 : 0.5, ease: EASE, delay: intro ? 0.1 + col * 0.32 : 0 });
  const lineMotion = (col: number) => ({
    duration: reduceMotion ? 0 : intro ? 0.9 : 0.5,
    ease: [0.45, 0, 0.2, 1] as const,
    delay: intro ? 0.3 + col * 0.32 : 0,
  });

  const nodeAlpha = (id: string) => {
    if (focusSet) return focusSet.has(id) ? 1 : 0.16;
    return 1;
  };

  const linkAlpha = (source: string, target: string, changed: boolean) => {
    if (focusSet) return focusSet.has(source) && focusSet.has(target) ? 1 : 0.07;
    return changed ? 0.95 : 0.34;
  };

  const lineWidth = (source: string, target: string, changed: boolean) =>
    focusSet && focusSet.has(source) && focusSet.has(target) ? 1.9 : changed ? 1.5 : 1;

  const top = 118;
  const bottom = p.height - 60;

  return (
    <svg
      width={p.width}
      height={p.height}
      viewBox={-(p.width / p.zoom - p.width) / 2 + " " + -(p.height / p.zoom - p.height) / 2 + " " + p.width / p.zoom + " " + p.height / p.zoom}
      className="mx-auto block select-none" role="presentation" onClick={() => p.onSelect(null)}>
      {/* Column headers: a numbered title, a short rule, how many, and a faint guide line down the column. */}
      {COLUMNS.map((type, i) => {
        const x = layout.columnX[i];
        return (
          <g key={type} className="font-aeonik-mono text-text-primary dark:text-white">
            <text x={x - 6} y={90} fontSize={11} fontWeight={600} className="fill-accent">
              {"0" + (i + 1)}
            </text>
            <text x={x + 18} y={90} fontSize={11} letterSpacing="0.14em" fillOpacity={0.85} className="fill-current">
              {COLUMN_TITLE[type].toUpperCase()}
            </text>
            <text x={x - 6} y={108} fontSize={10} fillOpacity={0.4} className="fill-current">
              {layout.columnCount[i] + (layout.columnCount[i] === 1 ? " item" : " items")}
            </text>
            <line x1={x} x2={x} y1={top} y2={bottom} stroke="currentColor" strokeOpacity={0.07} strokeDasharray="2 6" />
          </g>
        );
      })}

      {/* Ribbons. */}
      <g fill="none">
        {layout.links.map((l) => {
          const changed = l.state !== "normal";
          const col = layout.nodes.get(l.source)?.col ?? 0;
          const alpha = linkAlpha(l.source, l.target, changed);
          return (
            <motion.path
              key={l.id}
              className={TONE[l.state]}
              stroke="currentColor"
              strokeLinecap="round"
              initial={{ d: l.d, pathLength: 0, strokeOpacity: 0, strokeWidth: 1 }}
              animate={{ d: l.d, pathLength: 1, strokeOpacity: alpha, strokeWidth: lineWidth(l.source, l.target, changed) }}
              transition={{ ...lineMotion(col), strokeOpacity: { duration: 0.2, delay: intro ? 0.3 + col * 0.32 : 0 } }}
            />
          );
        })}
      </g>

      {/* Dashes drifting along ribbons that carry a change: the direction a change travels. */}
      <g fill="none" pointerEvents="none">
        {layout.links
          .filter((l) => l.state !== "normal")
          .map((l) => {
            const lit = !focusSet || (focusSet.has(l.source) && focusSet.has(l.target));
            return (
              <motion.path
                key={"flow-" + l.id}
                className={TONE[l.state] + (reduceMotion ? "" : " seismo-flow")}
                stroke="currentColor"
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeDasharray="0.1 16"
                initial={{ d: l.d, strokeOpacity: 0 }}
                animate={{ d: l.d, strokeOpacity: lit ? 1 : 0 }}
                transition={{ duration: 0.4, delay: intro ? 1.4 + (layout.nodes.get(l.source)?.col ?? 0) * 0.32 : 0 }}
              />
            );
          })}
      </g>

      {/* Bars and labels. */}
      {[...layout.nodes.values()].map((n) => {
        const { node } = n;
        const changed = node.state !== "normal";
        const isSelected = node.id === p.selectedId;
        const isHover = node.id === p.hoverId;
        const text = labelOf(node);
        const textW = text.length * (node.type === "service" ? 7.8 : 7.2);
        const emphasised = isSelected || isHover;
        const grow = emphasised ? 1.12 : 1;
        return (
          <motion.g
            key={node.id}
            className={TONE[node.state]}
            initial={{ opacity: 0, x: -10, y: n.y }}
            animate={{ opacity: nodeAlpha(node.id), x: 0, y: n.y }}
            transition={barMotion(n.col)}
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              p.onSelect(node.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              p.onIsolate(node.id);
            }}
            onMouseEnter={() => p.onHover(node.id)}
            onMouseLeave={() => p.onHover(null)}
          >
            {/* A roomy hit area, so small circles are easy to hit. */}
            <rect x={n.x - n.r - 5} y={-4} width={Math.max(n.r * 2 + 10, textW + 14)} height={n.h + 30} fill="transparent" />

            {emphasised && (
              <rect
                x={n.x - n.r - 5}
                y={n.h + 1}
                width={textW + 12}
                height={20}
                rx={5}
                className="fill-section stroke-current dark:fill-dark-dash-section"
                strokeOpacity={isSelected ? 0.6 : 0.22}
                strokeDasharray={isSelected ? "3 3" : undefined}
              />
            )}

            {/* Broken things send out one slow, thin outline. */}
            {node.state === "breaking" && !reduceMotion && (
              <rect x={n.x - n.r} y={0} width={n.r * 2} height={n.h} rx={2} fill="none" stroke="currentColor" strokeWidth={1} className="seismo-ping" />
            )}

            <motion.rect
              initial={{ x: n.x, y: n.h / 2, width: 0, height: 0 }}
              animate={{
                x: n.x - n.r * grow,
                y: n.h / 2 - n.r * grow,
                width: n.r * 2 * grow,
                height: n.r * 2 * grow,
              }}
              rx={2}
              transition={{ duration: reduceMotion ? 0 : 0.35, ease: EASE }}
              className="fill-current"
              fillOpacity={changed || node.type === "service" ? 1 : 0.42}
            />
            {node.type === "service" && (
              <rect x={n.x - n.r - 3.5} y={-3.5} width={n.r * 2 + 7} height={n.h + 7} rx={3.5} fill="none" stroke="currentColor" strokeOpacity={0.35} strokeWidth={1} />
            )}
            {isSelected && (
              <rect
                x={n.x - n.r - 7}
                y={-7}
                width={n.r * 2 + 14}
                height={n.h + 14}
                rx={5}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.7}
                strokeWidth={1}
                strokeDasharray="3 3"
                className={reduceMotion ? "" : "seismo-flow"}
              />
            )}

            <text
              x={n.x - n.r}
              y={n.h + 11}
              dominantBaseline="central"
              fontSize={node.type === "service" ? 13 : 11.5}
              fontWeight={node.type === "service" ? 600 : 400}
              className="fill-text-primary font-aeonik-mono dark:fill-white"
              style={{ paintOrder: "stroke" }}
              strokeWidth={emphasised ? 0 : 5}
              strokeLinejoin="round"
              stroke="var(--flow-halo)"
            >
              {text}
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
}
