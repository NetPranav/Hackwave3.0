// v2-P3.6: the Settings screen's channel model <-> GET/PUT /v1/settings/notifications.
import type { ChannelsState, Threshold } from "@/lib/mock/settings";
import type { NotificationSettings, Severity } from "./types";

const toSeverity: Record<Threshold, Severity> = { all: "info", suspected: "warning", breaking: "breaking" };
const toThreshold: Record<Severity, Threshold> = { info: "all", warning: "suspected", breaking: "breaking" };

export function channelsFromSettings(s: NotificationSettings, repos: string[]): ChannelsState {
  const discord = s.discord.enabled || (!s.slack.webhookUrl && !!s.discord.webhookUrl);
  const chat = discord ? s.discord : s.slack;
  return {
    dashboard: { enabled: true, threshold: toThreshold[s.minSeverity], value: "" },
    github: { enabled: s.github.enabled, threshold: toThreshold[s.github.minSeverity ?? s.minSeverity], value: repos.join(", ") },
    whatsapp: { enabled: s.whatsapp.enabled, threshold: toThreshold[s.whatsapp.minSeverity ?? "breaking"], value: s.whatsapp.to ?? "" },
    chat: { enabled: chat.enabled, threshold: toThreshold[chat.minSeverity ?? s.minSeverity], value: chat.webhookUrl ?? "", chatProvider: discord ? "discord" : "slack" },
    email: { enabled: s.email.enabled, threshold: toThreshold[s.email.minSeverity ?? s.minSeverity], value: s.email.to ?? "" },
  };
}

/** WhatsApp numbers are sent as E.164 (+91…): spaces and dashes are removed. */
const phone = (v: string) => v.replace(/[\s()-]/g, "");

export function settingsFromChannels(c: ChannelsState, aiEnabled: boolean, autoHeal = false): NotificationSettings {
  const chat = { enabled: c.chat.enabled, webhookUrl: c.chat.value || undefined, minSeverity: toSeverity[c.chat.threshold] };
  const off = { enabled: false };
  return {
    whatsapp: { enabled: c.whatsapp.enabled, to: c.whatsapp.value ? phone(c.whatsapp.value) : undefined, minSeverity: toSeverity[c.whatsapp.threshold] },
    slack: c.chat.chatProvider === "discord" ? off : chat,
    discord: c.chat.chatProvider === "discord" ? chat : off,
    email: { enabled: c.email.enabled, to: c.email.value || undefined, minSeverity: toSeverity[c.email.threshold] },
    github: { enabled: c.github.enabled, minSeverity: toSeverity[c.github.threshold] },
    minSeverity: toSeverity[c.dashboard.threshold],
    aiEnabled,
    autoHeal,
  };
}
