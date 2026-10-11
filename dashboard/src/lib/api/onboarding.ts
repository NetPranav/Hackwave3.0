"use client";

import { useCallback, useState } from "react";
import { FIRST_TRAFFIC, INSTALLATION, SCAN_RESULT, SDK_KEY_DEMO, SETUP_PR } from "@/lib/mock/onboarding";
import type { CodeMapView } from "./adapt";
import { api, USE_MOCKS, useLive } from "./live";
import type { Installation, Me, ServiceStatusApi } from "./types";

/**
 * v2-P2: the onboarding steps' data (Adarsh's design, A2.1), live from the engine or from lib/mock/onboarding in mock mode.
 * Install → scan (real rescan, counts from the code map) → SDK key (real, shown once) + first traffic → setup PR (real).
 */
export interface ScanSummary {
  files: number;
  apiCalls: number;
  fieldsMapped: number;
  unresolvedCalls: number;
  services: number;
}

export function summarize(cm: CodeMapView): ScanSummary {
  const resolved = cm.callSites.filter((c) => !c.unresolved);
  return {
    files: new Set([...cm.callSites.map((c) => c.file), ...cm.fieldReads.map((r) => r.file)]).size,
    apiCalls: resolved.length,
    fieldsMapped: new Set(cm.fieldReads.map((r) => r.callSiteId + "|" + r.field)).size,
    unresolvedCalls: cm.callSites.length - resolved.length,
    services: new Set(resolved.map((c) => c.service)).size,
  };
}

export function useOnboarding() {
  const live = !USE_MOCKS;
  const me = useLive<Me>(live ? "/v1/me" : null);
  const inst = useLive<Installation[]>(live ? "/v1/installations" : null, [], undefined, { pollMs: 3000 });
  const codemap = useLive<CodeMapView>(live ? "/v1/codemap" : null, [], undefined, { pollMs: 3000 });
  const status = useLive<{ services: ServiceStatusApi[] }>(live ? "/v1/status" : null, [], undefined, { pollMs: 3000 });
  const [key, setKey] = useState<string | null>(null);

  const installs = inst.data ?? [];
  const first = installs.find((i) => i.repos.length) ?? installs[0];
  const repos = first?.repos.map((r) => r.name) ?? [];
  const fullRepo = first && repos[0] ? first.account + "/" + repos[0] : undefined;

  const startScan = useCallback(async () => {
    if (!live || !fullRepo) return;
    await api(`/v1/repos/${fullRepo}/scan`, { method: "POST", body: {} }).catch(() => undefined);
    inst.reload();
  }, [live, fullRepo, inst]);

  const openSetupPr = useCallback(async () => {
    if (!live) return { number: SETUP_PR.number, url: SETUP_PR.url, title: SETUP_PR.title, created: true, alreadySetUp: false };
    if (!fullRepo) throw new Error("no repository");
    const r = await api<{ url: string; number: number; created: boolean; wrapped: number; alreadySetUp?: boolean }>(`/v1/repos/${fullRepo}/setup-pr`, { method: "POST", body: {} });
    return { number: r.number, url: r.url, alreadySetUp: !!r.alreadySetUp, title: r.wrapped ? `Seismo setup: ${r.wrapped} API reads wrapped + seismo/aliases.json` : "Seismo setup", created: r.created };
  }, [live, fullRepo]);

  const createKey = useCallback(async () => {
    if (!live) return setKey(SDK_KEY_DEMO);
    const projects = await api<{ id: string }[]>("/v1/projects");
    if (!projects[0]) throw new Error("not the owner");
    const r = await api<{ key: string }>(`/v1/projects/${encodeURIComponent(projects[0].id)}/keys`, { method: "POST", body: {} });
    setKey(r.key);
  }, [live]);

  if (!live) {
    return {
      live,
      loading: false,
      installed: true,
      account: INSTALLATION.account,
      repos: INSTALLATION.repos,
      settingsUrl: INSTALLATION.settingsUrl,
      installUrl: INSTALLATION.settingsUrl,
      scan: { state: "done" as const, summary: SCAN_RESULT },
      traffic: FIRST_TRAFFIC as { calls: number; source: string } | null,
      key,
      startScan,
      openSetupPr,
      createKey,
    };
  }

  const repoState = first?.repos[0]?.scan;
  const services = status.data?.services ?? [];
  const calls = Math.round(services.reduce((n, s) => n + s.callsPerMin, 0));
  return {
    live,
    loading: me.loading || inst.loading,
    installed: (me.data?.installations.length ?? 0) > 0 || installs.length > 0,
    account: first?.account ?? me.data?.login ?? "",
    repos,
    settingsUrl: first ? `https://github.com/settings/installations/${first.id}` : "https://github.com/settings/installations",
    installUrl: me.data?.installUrl ?? "https://github.com/apps/seismo-app/installations/new",
    scan: { state: (repoState ?? "pending") as "pending" | "running" | "done" | "failed", summary: summarize(codemap.data ?? { repos: [], callSites: [], fieldReads: [], workflows: [] }) },
    traffic: services.length ? { calls, source: services.map((s) => s.service).join(", ") } : null,
    key,
    startScan,
    openSetupPr,
    createKey,
  };
}
