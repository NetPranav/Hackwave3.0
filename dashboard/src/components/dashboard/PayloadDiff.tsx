import { cn } from "@/lib/utils";

type LineKind = "same" | "changed" | "removed" | "added";

interface PayloadLine {
  key: string;
  text: string;
  kind: LineKind;
}

/** One line per key, marked by how it differs from the other payload. */
function payloadLines(payload: Record<string, unknown>, other: Record<string, unknown>, side: "before" | "after"): PayloadLine[] {
  const keys = Object.keys(payload);
  return keys.map((key, i) => {
    const comma = i < keys.length - 1 ? "," : "";
    const text = "  " + JSON.stringify(key) + ": " + JSON.stringify(payload[key]) + comma;
    if (!(key in other)) return { key, text, kind: side === "before" ? "removed" : "added" };
    const kind = JSON.stringify(payload[key]) === JSON.stringify(other[key]) ? "same" : "changed";
    return { key, text, kind };
  });
}

const LINE_CLASS: Record<LineKind, string> = {
  same: "text-text-primary/60 dark:text-white/60",
  changed: "bg-warn/[0.08] text-warn dark:bg-warn-bright/[0.1] dark:text-warn-bright",
  removed: "bg-bad/[0.08] text-bad dark:bg-bad-bright/[0.1] dark:text-bad-bright",
  added: "bg-ok/[0.08] text-ok dark:bg-ok-bright/[0.1] dark:text-ok-bright",
};

const MARK: Record<LineKind, string> = { same: " ", changed: "~", removed: "-", added: "+" };

interface PayloadPanelProps {
  title: string;
  tag: string;
  payload: Record<string, unknown>;
  other: Record<string, unknown>;
  side: "before" | "after";
  className?: string;
}

/** A JSON-style panel where keys that differ from the other side are tinted: red removed, green added, amber changed. */
export default function PayloadPanel({ title, tag, payload, other, side, className }: PayloadPanelProps) {
  const lines = payloadLines(payload, other, side);
  return (
    <div className={cn("rounded border border-box-outline/70 bg-inset dark:border-dark-border dark:bg-dark-inset", className)}>
      <div className="flex items-center justify-between border-b border-box-outline/50 px-4 py-2 font-aeonik-mono text-[10px] uppercase tracking-wider dark:border-dark-border/50">
        <span className="font-medium text-text-primary dark:text-white">{title}</span>
        <span className="text-text-primary/50 dark:text-white/45">{tag}</span>
      </div>
      <pre className="overflow-x-auto py-3 font-aeonik-mono text-[11px] leading-6">
        <div className="px-4 text-text-primary/40 dark:text-white/40">{"{"}</div>
        {lines.map((line) => (
          <div key={line.key} className={cn("grid grid-cols-[1.25rem_1fr] pr-4", LINE_CLASS[line.kind])}>
            <span aria-hidden className="select-none text-center font-bold">
              {MARK[line.kind]}
            </span>
            <span className="whitespace-pre">{line.text}</span>
          </div>
        ))}
        <div className="px-4 text-text-primary/40 dark:text-white/40">{"}"}</div>
      </pre>
    </div>
  );
}
