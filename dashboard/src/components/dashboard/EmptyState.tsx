import Link from "next/link";
import { Card } from "@/components/dashboard/Card";
import PageFallback from "@/components/dashboard/PageFallback";

/**
 * v2-P3.8: what a screen shows when the engine has nothing for it yet. It says what to do next; it never shows
 * made-up data. `loading` shows the skeleton instead.
 */
export default function EmptyState({
  loading,
  label,
  title,
  body,
  action,
}: {
  loading?: boolean;
  label: string;
  title: string;
  body: string;
  action?: { href: string; text: string; external?: boolean };
}) {
  if (loading) return <PageFallback label={"Loading " + label.toLowerCase()} />;
  return (
    <main className="mx-auto max-w-[1440px] space-y-6 px-6 py-6 md:px-10 lg:px-16">
      <Card className="px-5 py-12 text-center">
        <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45">{label}</p>
        <p className="mt-3 font-aeonik text-base font-medium text-text-primary dark:text-white">{title}</p>
        <p className="mx-auto mt-1 max-w-xl font-aeonik-light text-sm text-text-primary/60 dark:text-white/60">{body}</p>
        {action &&
          (action.external ? (
            <a
              href={action.href}
              className="mt-4 inline-block font-aeonik-mono text-xs uppercase tracking-wider text-accent underline-offset-4 hover:underline"
            >
              {action.text} ↗
            </a>
          ) : (
            <Link href={action.href} className="mt-4 inline-block font-aeonik-mono text-xs uppercase tracking-wider text-accent underline-offset-4 hover:underline">
              {action.text} ↗
            </Link>
          ))}
      </Card>
    </main>
  );
}
