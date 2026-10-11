import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** Drifts with the mouse. `strength` is roughly how many pixels it can move at the edge of the screen. */
export default function Float({ children, strength = 12, className }: { children: React.ReactNode; strength?: number; className?: string }) {
  return (
    <div data-float="" style={{ "--float": strength } as CSSProperties} className={cn(className)}>
      {children}
    </div>
  );
}
