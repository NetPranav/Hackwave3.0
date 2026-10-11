"use client";

import { Fragment } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export interface PathNode {
  label: string;
  /** Orange when the change actually reaches this step. */
  hit?: boolean;
  muted?: boolean;
}

/** The route a change travels: provider, endpoint, field, code, workflow. Each step appears in turn. */
export default function ImpactPath({ nodes }: { nodes: PathNode[] }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <ol className="flex flex-wrap items-center gap-2 font-aeonik-mono text-xs">
      {nodes.map((node, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <li aria-hidden className="text-text-primary/30 dark:text-white/30">
              →
            </li>
          )}
          <motion.li
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.08, ease: "easeOut" }}
            className={cn(
              "rounded border px-2.5 py-1",
              node.hit
                ? "border-accent/40 bg-accent/10 font-medium text-accent"
                : node.muted
                  ? "border-box-outline/60 text-text-primary/40 dark:border-dark-border/60 dark:text-white/40"
                  : "border-box-outline text-text-primary dark:border-dark-border dark:text-white"
            )}
          >
            {node.label}
          </motion.li>
        </Fragment>
      ))}
    </ol>
  );
}
