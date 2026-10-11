import { cn } from "@/lib/utils";

/** Tiny bar sparkline. `values` are relative heights, 0–100. */
export default function Sparkline({ values, className }: { values: number[]; className?: string }) {
  return (
    <div aria-hidden className={cn("flex h-4 items-end gap-[2px]", className)}>
      {values.map((v, i) => (
        <span
          key={i}
          style={{ height: `${Math.max(v, 8)}%` }}
          className="w-[3px] rounded-t-[1px] bg-text-primary/60 dark:bg-white/60"
        />
      ))}
    </div>
  );
}
