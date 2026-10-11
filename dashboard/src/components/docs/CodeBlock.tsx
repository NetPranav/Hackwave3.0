"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  /** File name or command shown on the tab, e.g. "server.ts" or "terminal". */
  title: string;
  className?: string;
}

/** A code box with a file tab and a copy button. Comment lines are dimmed so the real lines stand out. */
export default function CodeBlock({ code, title, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked; the text is still selectable.
    }
  };

  return (
    <figure className={cn("overflow-hidden rounded-md border border-box-outline bg-inset", className)}>
      <figcaption className="flex items-center justify-between border-b border-box-outline/70 bg-section px-4 py-2">
        <span className="font-aeonik-mono text-[11px] uppercase tracking-wider text-text-primary/60">{title}</span>
        <button
          type="button"
          onClick={copy}
          className="rounded border border-box-outline px-2 py-1 font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/70 transition-colors hover:border-text-primary hover:text-text-primary"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>
      <pre className="overflow-x-auto px-4 py-4 font-aeonik-mono text-[13px] leading-relaxed text-text-primary">
        <code>
          {code.split("\n").map((line, i) => (
            <span key={i} className={cn("block min-h-[1.4em]", /^\s*(\/\/|#)/.test(line) && "text-text-primary/45")}>
              {line}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
