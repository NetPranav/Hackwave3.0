import { Card } from "@/components/dashboard/Card";

/** Placeholder while a route's params resolve: same width and card shell as the page, so nothing jumps. */
export default function PageFallback({ label }: { label: string }) {
  return (
    <main className="mx-auto max-w-[1440px] space-y-6 px-6 py-6 md:px-10 lg:px-16" aria-busy="true">
      <Card className="p-5 md:p-6">
        <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45">
          {label}
        </p>
        <div className="mt-4 h-8 w-64 animate-pulse rounded bg-dash-bg dark:bg-white/[0.06]" />
        <div className="mt-3 h-3 w-96 max-w-full animate-pulse rounded bg-dash-bg dark:bg-white/[0.06]" />
      </Card>
    </main>
  );
}
