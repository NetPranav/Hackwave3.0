import Link from "next/link";
import Logo from "@/components/layout/Logo";

/** Slim public header for the docs: logo, where you are, and the way into the dashboard. */
export default function DocsHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-box-outline bg-section/95 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-[1440px] items-center justify-between px-6 md:px-10 lg:px-16">
        <div className="flex items-center gap-3">
          <Logo href="/" />
          <span className="font-aeonik-mono text-xs text-text-primary/30">/</span>
          <span className="font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/60">Docs · SDK</span>
        </div>
        <Link
          href="/app"
          className="rounded border border-box-outline px-3 py-1.5 font-aeonik-mono text-[11px] uppercase tracking-wider transition-colors hover:bg-dash-bg"
        >
          Open dashboard
        </Link>
      </div>
    </header>
  );
}
