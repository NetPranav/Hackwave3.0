"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "seismo_theme";
const THEME_EVENT = "seismo:theme-change";

function readIsDark(): boolean {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Theme from localStorage, safe for SSR: the server snapshot is always light, so hydration matches,
 * then React re-renders with the real value. Toggling updates the <html> class and notifies every consumer.
 */
export function useTheme() {
  const isDark = useSyncExternalStore(subscribe, readIsDark, () => false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const toggle = useCallback(() => {
    const next = !readIsDark();
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { dark: next } }));
  }, []);

  return { isDark, toggle };
}
