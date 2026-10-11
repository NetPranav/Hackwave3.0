import Link from "next/link";
import Logo from "@/components/layout/Logo";
import { NAV_LINKS } from "@/lib/landing";

/** Floating pill nav. Anchors scroll to sections; the two buttons go to sign in. */
export default function LandingNav() {
  return (
    <header className="fixed inset-x-3 top-3 z-50 md:inset-x-6">
      <div className="mx-auto flex h-12 max-w-[1440px] items-center justify-between rounded-md border border-box-outline bg-section/85 px-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md md:px-5">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/70 transition-colors hover:text-accent"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-md border border-text-primary px-3.5 py-1.5 font-aeonik-mono text-xs uppercase tracking-wider transition-colors hover:bg-dash-bg sm:block"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="rounded-md bg-btn-primary px-3.5 py-1.5 font-aeonik-mono text-xs uppercase tracking-wider text-white transition-transform hover:scale-[1.03]"
          >
            Install on GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}
