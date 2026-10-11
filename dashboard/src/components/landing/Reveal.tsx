import { cn } from "@/lib/utils";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** How far it travels when its slide comes in. Bigger numbers move more, which gives the parallax. */
  depth?: number;
}

/** Marks an element for the deck's slide-in animation. The deck reads data-enter and data-depth; phones just show it. */
export default function Reveal({ children, className, depth = 1 }: RevealProps) {
  return (
    <div data-enter="" data-depth={depth} className={cn(className)}>
      {children}
    </div>
  );
}
