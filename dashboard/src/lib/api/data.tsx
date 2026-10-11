"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { sitesFor as mockSitesFor, UNRESOLVED_READS, type CodeSite } from "@/lib/mock/codemap";
import { DRIFT_DETAILS_MAP, type DriftDetailData } from "@/lib/mock/drift";
import { FIX_RULES, type FixRuleData } from "@/lib/mock/fixes";
import { CHART_DAYS, CHART_MAX, CHART_TICKS, type ChartDay, type ChartMetric } from "@/lib/mock/overview";
import { RADAR_ITEMS, type RadarItem } from "@/lib/mock/radar";
import { REVIEW_ITEMS, type ReviewItem } from "@/lib/mock/review";
import { SERVICES_STATUS_DATA, type ServiceStatusItem } from "@/lib/mock/status";
import { TIMELINE_BUCKETS, TIMELINE_BUCKET_MS, TIMELINE_EVENTS, TIMELINE_NOW, TIMELINE_WINDOW_START, type TimelineItem } from "@/lib/mock/timeline";
import {
  EMPTY_CODEMAP,
  sitesFromCodemap,
  toChart,
  toDriftDetail,
  toFixes,
  toRadar,
  toReview,
  toServices,
  toTimeline,
  unresolvedFromCodemap,
  type CodeMapView,
  type MetricsDay,
} from "./adapt";
import { api, USE_MOCKS, useLive, useLiveContext } from "./live";
import type { CompareApi, Coverage, DriftEvent, Me, RadarItemApi, ReviewItemApi, ServiceStatusApi } from "./types";

/**
 * v2-P3: one place that loads the engine's data and hands every screen the view models it was designed with.
 * Screens call `useSeismoData()` instead of importing `@/lib/mock/*` constants. With NEXT_PUBLIC_USE_MOCKS=1 the same
 * hook returns the mock data, so design work never needs a backend.
 */
export interface SeismoData {
  mode: "live" | "mock";
  /** true until the first answer from the backend */
  loading: boolean;
  /** the backend could not be reached (screens keep the last data they had) */
  offline: boolean;
  me?: Me;
  services: ServiceStatusItem[];
  timeline: TimelineItem[];
  timelineWindow: { start: number; bucketMs: number; buckets: number; now: number };
  fixes: FixRuleData[];
  review: ReviewItem[];
  radar: RadarItem[];
  driftDetail: (id: string) => DriftDetailData | undefined;
  sitesFor: (serviceSlug: string, field: string) => CodeSite[];
  unresolvedReads: { file: string; line: number; reason: string }[];
  codeUrl: (file: string, line: number) => string | undefined;
  codeMap: { fieldCoverage: number; callSites: number; repos: string[] };
  chart: { days: ChartDay[]; max: Record<ChartMetric, number>; ticks: Record<ChartMetric, string[]> };
  /** the last 32 minutes per minute (null in mock mode) */
  liveChart: { days: ChartDay[]; max: Record<ChartMetric, number>; ticks: Record<ChartMetric, string[]> } | null;
  raw: { events: DriftEvent[]; radar: RadarItemApi[]; codemap: CodeMapView };
}

const MOCK: SeismoData = {
  mode: "mock",
  loading: false,
  offline: false,
  services: SERVICES_STATUS_DATA,
  timeline: TIMELINE_EVENTS,
  timelineWindow: { start: TIMELINE_WINDOW_START, bucketMs: TIMELINE_BUCKET_MS, buckets: TIMELINE_BUCKETS, now: TIMELINE_NOW },
  fixes: FIX_RULES,
  review: REVIEW_ITEMS,
  radar: RADAR_ITEMS,
  driftDetail: (id) => DRIFT_DETAILS_MAP[id],
  sitesFor: mockSitesFor,
  unresolvedReads: UNRESOLVED_READS,
  codeUrl: (file, line) => "https://github.com/NetPranav/seismo-demo-shop/blob/main/" + file + "#L" + line,
  codeMap: { fieldCoverage: 98.4, callSites: 186, repos: ["demo/shop"] },
  chart: { days: CHART_DAYS, max: CHART_MAX, ticks: CHART_TICKS },
  liveChart: null,
  raw: { events: [], radar: [], codemap: EMPTY_CODEMAP },
};

const DataContext = createContext<SeismoData | null>(null);

const WINDOW_BUCKETS = 12;
const BUCKET_MS = 15 * 60 * 1000;

/** /v1/compare for every endpoint we show (field statistics + synthetic samples), refreshed every 15 s. */
function useCompares(keys: string[]): Record<string, CompareApi> {
  const [out, setOut] = useState<Record<string, CompareApi>>({});
  const joined = keys.join("\n");
  useEffect(() => {
    if (USE_MOCKS || !joined) return;
    let alive = true;
    const load = async () => {
      const entries = await Promise.all(
        joined.split("\n").map(async (k) => {
          const [service, endpoint] = k.split("|");
          try {
            const c = await api<CompareApi>(`/v1/compare?service=${encodeURIComponent(service)}&endpoint=${encodeURIComponent(endpoint)}`);
            return [k, c] as const;
          } catch {
            return null;
          }
        })
      );
      if (alive) setOut(Object.fromEntries(entries.filter((e): e is readonly [string, CompareApi] => e !== null)));
    };
    void load();
    const t = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [joined]);
  return out;
}

function LiveDataProvider({ children }: { children: ReactNode }) {
  const { connected } = useLiveContext();
  const drift = ["drift.created", "drift.updated"] as const;
  const me = useLive<Me>("/v1/me");
  const status = useLive<{ services: ServiceStatusApi[] }>("/v1/status", [...drift], undefined, { pollMs: 5_000 });
  const events = useLive<DriftEvent[]>("/v1/drift-events", [...drift]);
  const review = useLive<ReviewItemApi[]>("/v1/review", [...drift]);
  const codemap = useLive<CodeMapView>("/v1/codemap", [], undefined, { pollMs: 60_000 });
  const coverage = useLive<Coverage>("/v1/coverage", [], undefined, { pollMs: 60_000 });
  const metrics = useLive<MetricsDay[]>("/v1/metrics", ["drift.created"], undefined, { pollMs: 60_000 });
  const liveMetrics = useLive<MetricsDay[]>("/v1/metrics?range=live", ["drift.created"], undefined, { pollMs: 5_000 });
  const radar = useLive<RadarItemApi[]>("/v1/radar", ["radar.created", ...drift], undefined, { pollMs: 60_000 });
  // The clock starts after mount (Next must not read Date.now() while prerendering), then ticks every 30 s.
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  const evs = useMemo(() => events.data ?? [], [events.data]);
  const svcStatus = useMemo(() => status.data?.services ?? [], [status.data]);
  const cm = codemap.data ?? EMPTY_CODEMAP;
  const compareKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const s of svcStatus) for (const ep of s.endpoints) keys.add(s.service + "|" + ep.method + " " + ep.endpoint);
    for (const e of evs) keys.add(e.service + "|" + e.endpoint);
    return [...keys].sort();
  }, [svcStatus, evs]);
  const compares = useCompares(compareKeys);

  const value = useMemo<SeismoData>(() => {
    const reviewItems = review.data ?? [];
    const reviewIds = new Set(reviewItems.map((r) => r.drift.id));
    const radarItems = radar.data ?? [];
    const cov = coverage.data;
    const loading = [status, events, review, codemap].some((r) => r.loading && r.data === undefined);
    const offline = !connected && [status, events].some((r) => r.error !== undefined);
    return {
      mode: "live",
      loading,
      offline,
      me: me.data,
      services: toServices(svcStatus, evs, reviewIds, cm, compares, now),
      timeline: toTimeline(evs, reviewIds, radarItems, cm, now),
      timelineWindow: { start: now - WINDOW_BUCKETS * BUCKET_MS, bucketMs: BUCKET_MS, buckets: WINDOW_BUCKETS, now },
      fixes: toFixes(evs),
      review: toReview(reviewItems),
      radar: toRadar(radarItems),
      driftDetail: (id) => {
        const e = evs.find((x) => x.id === id);
        return e ? toDriftDetail(e, compares[e.service + "|" + e.endpoint], reviewIds) : undefined;
      },
      sitesFor: (slug, field) => sitesFromCodemap(cm, slug, field),
      unresolvedReads: unresolvedFromCodemap(cm),
      codeUrl: (file, line) => {
        const repo = cm.fieldReads.find((r) => r.file === file)?.repo ?? cm.repos[0]?.repo;
        const commit = cm.repos.find((r) => r.repo === repo)?.commit;
        return repo && commit && repo.includes("/") ? `https://github.com/${repo}/blob/${commit}/${file}#L${line}` : undefined;
      },
      codeMap: {
        fieldCoverage: cov && cov.fieldsSeen ? Math.round((cov.fieldsMapped / cov.fieldsSeen) * 1000) / 10 : 0,
        callSites: cm.callSites.filter((c) => !c.unresolved).length,
        repos: cm.repos.map((r) => r.repo),
      },
      chart: toChart(metrics.data ?? [], evs),
      liveChart: liveMetrics.data ? toChart(liveMetrics.data, evs, true) : null,
      raw: { events: evs, radar: radarItems, codemap: cm },
    };
  }, [me.data, svcStatus, evs, review, radar.data, coverage.data, cm, compares, metrics.data, liveMetrics.data, now, connected, status, events, codemap]);

  return <DataContext value={value}>{children}</DataContext>;
}

export function SeismoDataProvider({ children }: { children: ReactNode }) {
  if (USE_MOCKS) return <DataContext value={MOCK}>{children}</DataContext>;
  return <LiveDataProvider>{children}</LiveDataProvider>;
}

export function useSeismoData(): SeismoData {
  return useContext(DataContext) ?? MOCK;
}
