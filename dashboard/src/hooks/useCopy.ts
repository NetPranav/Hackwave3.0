"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Copy text to the clipboard; `copied` holds the label of the last copy for 2 s. */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = useCallback((text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(label);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 2000);
  }, []);

  return { copied, copy };
}
