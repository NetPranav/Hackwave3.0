import { cn } from "@/lib/utils";

export type StepState = "locked" | "active" | "done" | "skipped";

interface StepShellProps {
  index: number;
  title: string;
  hint: string;
  state: StepState;
  optional?: boolean;
  last?: boolean;
}

/** One row of the step list: a numbered dot on a vertical line, the title, and a one-line hint. The step itself opens on the right. */
export default function StepShell({ index, title, hint, state, optional, last }: StepShellProps) {
  const done = state === "done" || state === "skipped";
  return (
    <li aria-current={state === "active" ? "step" : undefined} className="relative flex gap-4">
      {!last && <span aria-hidden className={cn("absolute bottom-0 left-[13px] top-8 w-px", done ? "bg-accent/60" : "bg-box-outline")} />}
      <span
        className={cn(
          "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-aeonik-mono text-xs",
          state === "active" && "border-accent bg-accent text-white",
          done && "border-accent bg-section text-accent",
          state === "locked" && "border-box-outline bg-section text-text-primary/40"
        )}
      >
        {done ? "✓" : index}
      </span>
      <div className="min-w-0 flex-1 pb-3">
        <div
          className={cn(
            "group relative -mt-1 overflow-hidden rounded-md px-3 py-1.5",
            state === "locked" ? "cursor-not-allowed opacity-50" : "cursor-default"
          )}
        >
          {state !== "locked" && (
            <span
              aria-hidden
              className="absolute inset-0 origin-left scale-x-0 bg-btn-primary transition-transform duration-300 ease-out group-hover:scale-x-100"
            />
          )}
          <div className="relative flex flex-wrap items-baseline gap-x-3">
            <h2
              className={cn(
                "font-aeonik tracking-tight transition-colors duration-300 group-hover:text-white",
                state === "active" ? "text-lg" : "text-base text-text-primary/80"
              )}
            >
              {title}
            </h2>
            {optional && <span className="font-aeonik-mono text-[10px] uppercase tracking-[0.2em] text-text-primary/45 transition-colors duration-300 group-hover:text-white/60">Optional</span>}
            {state === "skipped" && <span className="font-aeonik-mono text-[10px] uppercase tracking-[0.2em] text-text-primary/45 transition-colors duration-300 group-hover:text-white/60">Skipped</span>}
          </div>
          <p className="relative mt-0.5 font-aeonik-light text-xs text-text-primary/60 transition-colors duration-300 group-hover:text-white/70">{hint}</p>
        </div>
      </div>
    </li>
  );
}
