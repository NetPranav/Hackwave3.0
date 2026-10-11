"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/dashboard/Card";
import EmptyState from "@/components/dashboard/EmptyState";
import { cn } from "@/lib/utils";

interface Scenario {
  id: string;
  service: string;
  title: string;
  kind: string;
  detector?: string;
  description: string;
  enabled: boolean;
  percent: number;
}

const BUTTON =
  "inline-flex items-center gap-1.5 rounded border border-box-outline px-3 py-1.5 font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/80 transition-colors hover:border-text-primary hover:text-text-primary disabled:opacity-40 dark:border-dark-border dark:text-white/80 dark:hover:text-white";

async function demo<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch("/api/demo/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()) as T;
}

/** Demo Control: switch each fake provider change on or off (or roll it out gradually) and reset everything. */
export default function DemoControl() {
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    demo<Scenario[]>("scenarios")
      .then((s) => {
        setScenarios(s);
        setError("");
      })
      .catch((e: Error) => setError(e.message === "404" ? "off" : "unreachable"));
  }, []);
  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  const act = async (key: string, path: string, body: unknown, message: string) => {
    setBusy(key);
    try {
      await demo(path, body);
      setNote(message);
    } catch {
      setNote("That did not work: is `npm run dev` running?");
    }
    setBusy(null);
    load();
  };

  if (error === "off")
    return <EmptyState label="Demo Control" title="Demo mode is off" body="Set DEMO_MODE=true for the dashboard to flip the fake providers from here." />;
  if (!scenarios)
    return (
      <EmptyState
        loading={!error}
        label="Demo Control"
        title="Fake providers unreachable"
        body="Start them with npm run dev (they listen on SERVICES_URL, default http://localhost:4100)."
      />
    );

  return (
    <main className="mx-auto max-w-[1440px] space-y-6 px-6 py-6 md:px-10 lg:px-16">
      <Card className="p-5 md:p-6">
        <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45">Demo Control</p>
        <h1 className="mt-2 font-aeonik text-2xl text-text-primary dark:text-white">Change a provider, watch Seismo catch it</h1>
        <p className="mt-2 max-w-3xl font-aeonik-light text-sm text-text-primary/70 dark:text-white/70">
          Each switch makes one fake API change silently, like a real provider would. Seismo needs about a minute of normal traffic as a
          baseline first, then about a minute to confirm a change (two detection passes). Keep traffic flowing (the shop or{" "}
          <code className="font-aeonik-mono">npm run demo:traffic</code>).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={BUTTON}
            disabled={busy !== null}
            onClick={() => act("reset", "reset", {}, "Reset: every provider back to v1, Seismo's events and baselines cleared.")}
          >
            Reset everything
          </button>
          {note && <span className="font-aeonik-light text-xs text-text-primary/60 dark:text-white/60">{note}</span>}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {scenarios.map((s) => (
          <Card key={s.id}>
            <CardHeader title={s.service.toUpperCase() + (s.detector ? " · " + s.detector : "")} />
            <div className="space-y-3 px-5 py-4">
              <p className="font-aeonik text-base text-text-primary dark:text-white">{s.title}</p>
              <p className="font-aeonik-light text-sm text-text-primary/60 dark:text-white/60">{s.description}</p>
              <div className="flex items-center justify-between gap-3">
                <span className={cn("font-aeonik-mono text-[11px] uppercase tracking-wider", s.enabled ? "text-accent" : "text-text-primary/50 dark:text-white/45")}>
                  {s.enabled ? "changed · " + s.percent + "% of responses" : "normal (v1)"}
                </span>
                <button
                  type="button"
                  className={BUTTON}
                  disabled={busy !== null}
                  onClick={() =>
                    act(s.id, "scenarios/" + s.id, { enabled: !s.enabled }, s.enabled ? s.title + ": back to v1." : s.title + ": live now. Watch the timeline.")
                  }
                >
                  {s.enabled ? "Turn off" : "Turn on"}
                </button>
              </div>
              <label className="flex items-center gap-3 font-aeonik-mono text-[11px] uppercase tracking-wider text-text-primary/60 dark:text-white/60">
                Rollout
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  defaultValue={s.enabled ? s.percent : 0}
                  disabled={busy !== null}
                  onMouseUp={(e) => act(s.id, "rollout/" + s.id, { percent: Number((e.target as HTMLInputElement).value) }, s.title + ": rolled out to " + (e.target as HTMLInputElement).value + "%.")}
                  className="w-full accent-accent"
                  aria-label={"Rollout percent for " + s.title}
                />
              </label>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
