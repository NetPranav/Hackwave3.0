"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/dashboard/Card";
import { api, useLive } from "@/lib/api/live";
import type { SdkKeyInfo } from "@/lib/api/types";

/**
 * v2-P3.6: SDK keys for the project (the owner only; the backend answers 403 to anyone else).
 * A new key is shown once; the engine stores only its hash.
 */
export default function SdkKeysCard() {
  const projects = useLive<{ id: string; owner: string }[]>("/v1/projects");
  const project = projects.data?.[0]?.id;
  const keys = useLive<SdkKeyInfo[]>(project ? `/v1/projects/${encodeURIComponent(project)}/keys` : null, [], undefined, { pollMs: 300_000 });
  const [fresh, setFresh] = useState<{ id: string; key: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const create = async () => {
    if (!project) return;
    setError("");
    try {
      setFresh(await api<{ id: string; key: string }>(`/v1/projects/${encodeURIComponent(project)}/keys`, { method: "POST", body: {} }));
      setCopied(false);
      keys.reload();
    } catch {
      setError("Could not create a key.");
    }
  };
  const revoke = async (id: string) => {
    if (!project) return;
    await api(`/v1/projects/${encodeURIComponent(project)}/keys/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => setError("Could not revoke the key."));
    if (fresh?.id === id) setFresh(null);
    keys.reload();
  };
  const copy = async () => {
    if (!fresh) return;
    await navigator.clipboard.writeText(fresh.key).catch(() => undefined);
    setCopied(true);
  };

  const MONO = "font-aeonik-mono text-xs";
  const BUTTON =
    "inline-flex items-center gap-1.5 rounded border border-box-outline px-3 py-1.5 font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/80 transition-colors hover:border-text-primary hover:text-text-primary dark:border-dark-border dark:text-white/80 dark:hover:text-white";

  return (
    <Card>
      <CardHeader title="SDK keys" />
      <div className="space-y-4 px-5 py-4 md:px-6">
        {projects.data && !project ? (
          <p className="font-aeonik-light text-sm text-text-primary/60 dark:text-white/60">This project belongs to another account. Ask its owner for a key.</p>
        ) : (
          <>
            <p className="font-aeonik-light text-sm text-text-primary/70 dark:text-white/70">
              Put the key in your app as <code className={MONO}>SEISMO_KEY</code> and call <code className={MONO}>seismo.init()</code> at start-up. Project{" "}
              <code className={MONO}>{project ?? "…"}</code>.
            </p>
            {fresh && (
              <div className="rounded border border-accent/40 bg-accent/[0.04] p-3">
                <p className="font-aeonik-mono text-[11px] uppercase tracking-wider text-accent">New key: copy it now, it is shown only once</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className={MONO + " break-all text-text-primary dark:text-white"}>{fresh.key}</code>
                  <button type="button" onClick={copy} className={BUTTON}>
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            )}
            <ul className="divide-y divide-box-outline/50 dark:divide-dark-border/50">
              {(keys.data ?? []).map((k) => (
                <li key={k.id} className="flex items-center justify-between py-2">
                  <span className={MONO + " text-text-primary dark:text-white"}>
                    {k.id === "env" ? "env (SEISMO_SDK_KEYS)" : "key " + k.id}
                    <span className="ml-2 text-text-primary/50 dark:text-white/45">
                      {k.revoked ? "revoked" : k.id === "env" ? "from the server environment" : "created " + new Date(k.createdAt).toLocaleString()}
                    </span>
                  </span>
                  {!k.revoked && k.id !== "env" && (
                    <button type="button" onClick={() => revoke(k.id)} className={BUTTON}>
                      Revoke
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3">
              <button type="button" onClick={create} disabled={!project} className={BUTTON}>
                Create key
              </button>
              {error && <span className="font-aeonik-light text-xs text-warn dark:text-warn-bright">{error}</span>}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
