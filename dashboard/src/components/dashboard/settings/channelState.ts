import type { ChannelConfig, ChannelMeta } from "@/lib/mock/settings";

export type ChannelStatus = "on" | "setup" | "off";

/** A light format check only. The real validation happens on the server. */
export function isConfigured(meta: ChannelMeta, cfg: ChannelConfig): boolean {
  const v = cfg.value.trim();
  switch (meta.id) {
    case "dashboard":
      return true;
    case "github":
      return /^[\w.-]+\/[\w.-]+$/.test(v);
    case "whatsapp":
      return v.replace(/\D/g, "").length >= 8;
    case "chat":
      return v.startsWith("https://");
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }
}

export function statusOf(meta: ChannelMeta, cfg: ChannelConfig): ChannelStatus {
  if (!cfg.enabled) return "off";
  return isConfigured(meta, cfg) ? "on" : "setup";
}

export const STATUS_LABEL: Record<ChannelStatus, string> = {
  on: "ON",
  setup: "SETUP NEEDED",
  off: "OFF",
};

export const STATUS_TEXT: Record<ChannelStatus, string> = {
  on: "text-ok dark:text-ok-bright",
  setup: "text-warn dark:text-warn-bright",
  off: "text-text-primary/40 dark:text-white/40",
};

export const STATUS_DOT: Record<ChannelStatus, string> = {
  on: "bg-ok dark:bg-ok-bright",
  setup: "bg-warn dark:bg-warn-bright",
  off: "bg-text-primary/25 dark:bg-white/25",
};
