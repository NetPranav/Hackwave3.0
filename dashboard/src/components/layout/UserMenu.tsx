"use client";

import Image from "next/image";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { USE_MOCKS, useLive } from "@/lib/api/live";
import type { Me } from "@/lib/api/types";

/** v2-P1.4: who is signed in (the GitHub login the backend sees) and sign out. */
export default function UserMenu() {
  const { data: me } = useLive<Me>("/v1/me");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  if (USE_MOCKS || !me) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Signed in as ${me.login}`}
        className="flex items-center gap-2 rounded border border-box-outline px-1.5 py-0.5 dark:border-dark-border"
      >
        <Image src={`https://github.com/${encodeURIComponent(me.login)}.png?size=40`} alt="" width={20} height={20} className="rounded-full" unoptimized />
        <span className="hidden font-aeonik-mono text-[11px] uppercase tracking-wider text-text-primary/80 dark:text-white/80 lg:inline">{me.login}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-50 w-56 rounded-lg border border-box-outline bg-section p-2 shadow-lg dark:border-dark-border dark:bg-dark-dash-section">
          <p className="px-2 py-1.5 font-aeonik-light text-sm text-text-primary/70 dark:text-white/70">
            Signed in as <span className="font-aeonik text-text-primary dark:text-white">{me.login}</span>
          </p>
          <p className="px-2 pb-2 font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/50 dark:text-white/50">
            {me.installations.length ? `${me.installations.length} installation${me.installations.length > 1 ? "s" : ""}` : "App not installed"}
          </p>
          <button
            onClick={() => signOut({ redirectTo: "/login" })}
            className="w-full rounded px-2 py-1.5 text-left font-aeonik-mono text-[11px] uppercase tracking-wider text-text-primary hover:bg-dash-bg dark:text-white dark:hover:bg-dark-border/40"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
