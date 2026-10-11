"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, USE_MOCKS, useLive, useLiveContext } from "@/lib/api/live";
import type { NotificationApi } from "@/lib/api/types";

const CHANNEL_LABEL: Record<NotificationApi["channel"], string> = {
  dashboard: "Dashboard",
  github: "GitHub issue",
  whatsapp: "WhatsApp",
  slack: "Slack",
  discord: "Discord",
  email: "Email",
};

/** v2-P3.7: the bell. Lists what Seismo sent (one row per drift event and channel); new ones arrive over SSE. */
export default function NotificationBell() {
  const { notifications: live, markAllRead } = useLiveContext();
  const { data, reload } = useLive<NotificationApi[]>("/v1/notifications", ["notification"]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (USE_MOCKS) return null;
  const byId = new Map<string, NotificationApi>();
  for (const n of [...live, ...(data ?? [])]) if (!byId.has(n.id)) byId.set(n.id, n);
  const items = [...byId.values()].filter((n) => n.channel === "dashboard").slice(0, 12);
  const unread = items.filter((n) => !n.read).length;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      markAllRead();
      await api("/v1/notifications/read", { method: "POST", body: {} }).catch(() => undefined);
      reload();
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className="relative flex h-7 w-7 items-center justify-center rounded border border-box-outline transition-colors hover:bg-dash-bg dark:border-dark-border dark:text-white dark:hover:bg-dark-border/40"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-aeonik-mono text-[9px] text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-50 w-80 rounded-lg border border-box-outline bg-section p-2 shadow-lg dark:border-dark-border dark:bg-dark-dash-section">
          <p className="px-2 py-1.5 font-aeonik-mono text-[10px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/50">Notifications</p>
          {items.length === 0 ? (
            <p className="px-2 py-3 font-aeonik-light text-sm text-text-primary/60 dark:text-white/60">Nothing yet. Breaking and suspected changes show up here.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/app/drift/${encodeURIComponent(n.driftId)}`}
                    onClick={() => setOpen(false)}
                    className="block rounded px-2 py-2 hover:bg-dash-bg dark:hover:bg-dark-border/40"
                  >
                    <span className="block font-aeonik text-sm text-text-primary dark:text-white">{n.title}</span>
                    <span className="font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/50 dark:text-white/50">
                      {new Date(n.sentAt).toLocaleTimeString()} · {CHANNEL_LABEL[n.channel]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
