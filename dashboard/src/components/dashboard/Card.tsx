import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: "section" | "div" | "article";
}

/** The dashboard card shell: hairline border, flat surface, `rounded-md`. Same as /app. */
export function Card({ as: Tag = "section", className, ...props }: CardProps) {
  return (
    <Tag
      className={cn(
        "overflow-hidden rounded-md border border-box-outline bg-section transition-colors dark:border-dark-border dark:bg-dark-dash-section",
        className
      )}
      {...props}
    />
  );
}

interface CardHeaderProps {
  title: string;
  aside?: React.ReactNode;
  className?: string;
}

/** Mono label row on top of a card: title on the left, optional status or actions on the right. */
export function CardHeader({ title, aside, className }: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-b border-box-outline px-5 py-3 dark:border-dark-border",
        className
      )}
    >
      <h3 className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45">
        {title}
      </h3>
      {aside}
    </div>
  );
}
