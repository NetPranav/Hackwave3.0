"use client";

import { useEffect, useRef, useState } from "react";
import { CHANNELS, DEFAULT_CHANNELS, type ChannelConfig, type ChannelId, type ChannelsState } from "@/lib/mock/settings";
import { useSeismoData } from "@/lib/api/data";
import { api, useLive } from "@/lib/api/live";
import { channelsFromSettings, settingsFromChannels } from "@/lib/api/settings";
import type { NotificationSettings } from "@/lib/api/types";
import SdkKeysCard from "./SdkKeysCard";
import ChannelStrip from "./ChannelStrip";
import ChannelPanel from "./ChannelPanel";
import AiFlagCard from "./AiFlagCard";

type SaveState = "idle" | "saving" | "saved" | "error";

/** Notification settings: pick a channel in the strip, configure it, send a test. Live: saved to the engine as you type. */
export default function SettingsView() {
  const data = useSeismoData();
  const live = data.mode === "live";
  const server = useLive<NotificationSettings>(live ? "/v1/settings/notifications" : null, [], undefined, { pollMs: 300_000 });
  const [channels, setChannels] = useState<ChannelsState>(DEFAULT_CHANNELS);
  const [selected, setSelected] = useState<ChannelId>("whatsapp");
  const [aiOn, setAiOn] = useState(true);
  const [save, setSave] = useState<SaveState>("idle");
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // First answer from the engine fills the form once; after that the form is the source of truth.
  const repos = data.codeMap.repos.join("|");
  useEffect(() => {
    if (!server.data || loaded.current) return;
    loaded.current = true;
    setChannels(channelsFromSettings(server.data, repos ? repos.split("|") : []));
    setAiOn(server.data.aiEnabled);
  }, [server.data, repos]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const persist = (next: ChannelsState, ai: boolean) => {
    if (!live || !loaded.current) return;
    clearTimeout(timer.current);
    setSave("saving");
    timer.current = setTimeout(() => {
      api("/v1/settings/notifications", { method: "PUT", body: settingsFromChannels(next, ai) })
        .then(() => setSave("saved"))
        .catch(() => setSave("error"));
    }, 600);
  };

  const meta = CHANNELS.find((c) => c.id === selected) ?? CHANNELS[0];
  const patch = (id: ChannelId, change: Partial<ChannelConfig>) => {
    // typing a number / address / webhook into a channel that is off switches it on (found live: the number was saved,
    // the channel stayed off, and no alert was ever sent)
    const autoOn = change.value && change.value.trim() && !channels[id].enabled && change.enabled === undefined ? { enabled: true } : {};
    const next = { ...channels, [id]: { ...channels[id], ...change, ...autoOn } };
    setChannels(next);
    persist(next, aiOn);
  };
  const setAi = (on: boolean) => {
    setAiOn(on);
    persist(channels, on);
  };

  return (
    <main className="mx-auto max-w-[1440px] space-y-6 px-6 py-6 md:px-10 lg:px-16">
      <ChannelStrip channels={channels} selected={selected} onSelect={setSelected} />
      <ChannelPanel key={meta.id} meta={meta} config={channels[meta.id]} onChange={(change) => patch(meta.id, change)} />
      <AiFlagCard aiOn={aiOn} onChange={setAi} />
      {live && <SdkKeysCard />}
      <p className="px-1 font-aeonik-light text-[11px] leading-relaxed text-text-primary/50 dark:text-white/45">
        {live
          ? save === "saving"
            ? "Saving…"
            : save === "saved"
              ? "✓ Saved. Alerts use these settings from the next change on."
              : save === "error"
                ? "Could not save. Check that the backend is running."
                : "Changes save automatically."
          : "Mock mode: settings live in this tab only and test sends are simulated."}
      </p>
    </main>
  );
}
