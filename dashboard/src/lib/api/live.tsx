"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { NotificationApi } from "./types";

/**
 * v2-P0.3: how every screen gets live data.
 *  - `api()` calls the backend through the server proxy `/api/seismo/...` (session → short JWT, see route.ts).
 *  - `<LiveProvider>` opens ONE EventSource to `/api/seismo/v1/events` for the whole dashboard and tells hooks when
 *    something changed (drift.created, drift.updated, status.updated, notification, radar.created).
 *  - `useLive(path, events)` fetches once, refetches when one of `events` arrives, and polls as a fallback
 *    (every 5 s while the stream is down, every 30 s while it is up).
 * `NEXT_PUBLIC_USE_MOCKS=1` turns all of this off; screens then use their mock data (design work without a backend).
 */
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "1";

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(`${status} ${code}`);
  }
}

export async function api<T>(path: string, init?: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/seismo${path}`, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    let code = res.statusText;
    try {
      code = ((await res.json()) as { error?: string }).error ?? code;
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, code);
  }
  return (await res.json()) as T;
}

export type LiveEvent = "drift.created" | "drift.updated" | "status.updated" | "notification" | "radar.created";
const EVENTS: LiveEvent[] = ["drift.created", "drift.updated", "status.updated", "notification", "radar.created"];

interface LiveContextValue {
  connected: boolean;
  subscribe: (fn: (event: LiveEvent, data: unknown) => void) => () => void;
  notifications: NotificationApi[];
  markAllRead: () => void;
}
const LiveContext = createContext<LiveContextValue | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationApi[]>([]);
  const listeners = useRef(new Set<(event: LiveEvent, data: unknown) => void>());

  useEffect(() => {
    if (USE_MOCKS) return;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    const open = () => {
      es = new EventSource("/api/seismo/v1/events");
      es.addEventListener("hello", () => setConnected(true));
      for (const name of EVENTS) {
        es.addEventListener(name, (msg) => {
          let data: unknown = null;
          try {
            data = JSON.parse((msg as MessageEvent<string>).data);
          } catch {
            /* ignore malformed */
          }
          if (name === "notification" && data) setNotifications((n) => [data as NotificationApi, ...n].slice(0, 50));
          for (const fn of listeners.current) fn(name, data);
        });
      }
      es.onerror = () => {
        setConnected(false);
        es?.close();
        if (!closed) retry = setTimeout(open, 5000);
      };
    };
    open();
    return () => {
      closed = true;
      clearTimeout(retry);
      es?.close();
    };
  }, []);

  const subscribe = useCallback((fn: (event: LiveEvent, data: unknown) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);
  const markAllRead = useCallback(() => setNotifications((n) => n.map((x) => ({ ...x, read: true }))), []);

  return <LiveContext value={{ connected, subscribe, notifications, markAllRead }}>{children}</LiveContext>;
}

export function useLiveContext(): LiveContextValue {
  const ctx = useContext(LiveContext);
  return ctx ?? { connected: false, subscribe: () => () => undefined, notifications: [], markAllRead: () => undefined };
}

export interface LiveResult<T> {
  data: T | undefined;
  error: ApiError | Error | undefined;
  loading: boolean;
  reload: () => void;
}

/** Fetch `path` and keep it fresh. Returns `mock` (and never fetches) when NEXT_PUBLIC_USE_MOCKS=1. */
export function useLive<T>(path: string | null, refreshOn: LiveEvent[] = [], mock?: T): LiveResult<T> {
  const { connected, subscribe } = useLiveContext();
  const [data, setData] = useState<T | undefined>(USE_MOCKS ? mock : undefined);
  const [error, setError] = useState<ApiError | Error | undefined>();
  const [loading, setLoading] = useState(!USE_MOCKS && path !== null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const events = refreshOn.join(",");

  useEffect(() => {
    if (USE_MOCKS || path === null) return;
    let alive = true;
    api<T>(path)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(undefined);
      })
      .catch((e: Error) => alive && setError(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [path, tick]);

  useEffect(() => {
    if (USE_MOCKS || path === null || !events) return;
    const wanted = new Set(events.split(","));
    let timer: ReturnType<typeof setTimeout> | undefined;
    // coalesce bursts (one detection pass can emit several events)
    return subscribe((e) => {
      if (!wanted.has(e)) return;
      clearTimeout(timer);
      timer = setTimeout(reload, 300);
    });
  }, [path, events, subscribe, reload]);

  useEffect(() => {
    if (USE_MOCKS || path === null) return;
    const t = setInterval(reload, connected ? 30_000 : 5_000);
    return () => clearInterval(t);
  }, [path, connected, reload]);

  return { data, error, loading, reload };
}
