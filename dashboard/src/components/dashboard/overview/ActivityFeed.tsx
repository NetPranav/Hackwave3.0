"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/dashboard/Card";
import { USE_MOCKS, useLive, useLiveContext } from "@/lib/api/live";
import { cn } from "@/lib/utils";

interface Activity {
  id: string;
  at: string;
  kind: "traffic" | "drift" | "ai" | "alert" | "pr" | "scan";
  text: string;
  ok?: boolean;
  service?: string;
  driftId?: string;
}

const KIND: Record<Activity["kind"], { label: string; tone: string }> = {
  traffic: { label: "TRAFFIC", tone: "text-text-primary/50 dark:text-white/45" },
  drift: { label: "CHANGE", tone: "text-accent" },
  ai: { label: "NEMOTRON", tone: "text-warn dark:text-warn-bright" },
  alert: { label: "ALERT", tone: "text-accent" },
  pr: { label: "FIX PR", tone: "text-ok dark:text-ok-bright" },
  scan: { label: "CODE MAP", tone: "text-text-primary/70 dark:text-white/70" },
};

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * v2: what Seismo is doing right now, live over SSE. Every SDK batch from the app, every detection, every Nemotron call
 * (with its latency, or "reused from cache"), every alert and PR. Made for showing the system working, not for analysis.
 */
export default function ActivityFeed() {
  const { connected } = useLiveContext();
  const { data } = useLive<Activity[]>(USE_MOCKS ? null : "/v1/activity", ["activity"], undefined, { pollMs: 5000 });
  const [showTraffic, setShowTraffic] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const newest = data?.[0]?.id ?? null;
  useEffect(() => {
    if (!newest) return;
    const on = setTimeout(() => setFlash(newest), 0);
    const off = setTimeout(() => setFlash(null), 1200);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [newest]);
  if (USE_MOCKS) return null;

  const items = (data ?? []).filter((a) => showTraffic || a.kind !== "traffic").slice(0, 14);
  const calls = (data ?? []).filter((a) => a.kind === "traffic").length;

  return (
    <Card>
      <CardHeader
        title={"Live activity" + (connected ? "" : " · reconnecting")}
        aside={
          <button
            type="button"
            onClick={() => setShowTraffic((v) => !v)}
            className="font-aeonik-mono text-[11px] uppercase tracking-wider text-text-primary/60 hover:text-text-primary dark:text-white/60 dark:hover:text-white"
          >
            {showTraffic ? "Hide traffic" : `Show traffic (${calls})`}
          </button>
        }
      />
      {items.length === 0 ? (
        <p className="px-5 py-6 font-aeonik-light text-sm text-text-primary/60 dark:text-white/60">
          Nothing yet.{" "}
          <a href="/api/shop" target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-accent">
            Open the shop
          </a>{" "}
          (the hosted one when it is up, else the local one) and place an order: every API call it makes shows up here within a few seconds.
        </p>
      ) : (
        <ul className="divide-y divide-box-outline/50 dark:divide-dark-border/50">
          {items.map((a) => (
            <li
              key={a.id}
              className={cn("flex items-start gap-3 px-5 py-2.5 transition-colors duration-700", flash === a.id && "bg-accent/[0.08]")}
            >
              <span className="w-16 shrink-0 pt-0.5 font-aeonik-mono text-[11px] tabular-nums text-text-primary/45 dark:text-white/40">{time(a.at)}</span>
              <span className={cn("w-20 shrink-0 pt-0.5 font-aeonik-mono text-[10px] tracking-wider", KIND[a.kind].tone)}>{KIND[a.kind].label}</span>
              <span className={cn("min-w-0 flex-1 font-aeonik-light text-sm", a.ok === false && a.kind !== "drift" ? "text-accent" : "text-text-primary dark:text-white")}>
                {a.driftId ? (
                  <Link href={"/app/drift/" + encodeURIComponent(a.driftId)} className="underline-offset-4 hover:underline">
                    {a.text}
                  </Link>
                ) : (
                  a.text
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
