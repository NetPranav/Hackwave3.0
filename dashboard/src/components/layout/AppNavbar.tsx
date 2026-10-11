"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "@/hooks/useTheme";
import Logo from "./Logo";
import NavMenu from "./NavMenu";
import { BREADCRUMBS } from "./navConfig";

function ThemeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle theme"
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className="flex min-w-[70px] items-center justify-center gap-1.5 rounded border border-box-outline bg-transparent px-2.5 py-1 font-aeonik-mono text-[11px] uppercase tracking-wider transition-colors hover:bg-dash-bg dark:border-dark-border dark:text-white dark:hover:bg-dark-border/40"
    >
      {isDark ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          <span>LIGHT</span>
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
          <span>DARK</span>
        </>
      )}
    </button>
  );
}

export default function AppNavbar() {
  const pathname = usePathname();
  const { isDark, toggle } = useTheme();
  const breadcrumb = BREADCRUMBS.find((b) => b.match(pathname))?.label;

  return (
    <header className="sticky top-0 z-40 border-b border-box-outline bg-section transition-colors duration-150 dark:border-dark-border dark:bg-dark-dash-section">
      <div className="relative mx-auto flex h-11 max-w-[1440px] items-center justify-between px-6 md:px-10 lg:px-16">
        <div className="flex items-center gap-3">
          <Logo href="/app" />
          {breadcrumb && (
            <>
              <span className="font-aeonik-mono text-xs text-text-primary/30 dark:text-white/30">/</span>
              <span className="font-aeonik-mono text-[11px] uppercase tracking-wider text-text-primary/70 dark:text-white/70">
                {breadcrumb}
              </span>
            </>
          )}
        </div>

        <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center md:flex">
          <NavMenu pathname={pathname} />
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1.5 font-aeonik-mono text-[10px] text-text-primary/60 dark:text-white/60 sm:flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok dark:bg-ok-bright" />
            <span>LIVE</span>
          </div>
          <ThemeToggle isDark={isDark} onToggle={toggle} />
        </div>
      </div>
    </header>
  );
}
