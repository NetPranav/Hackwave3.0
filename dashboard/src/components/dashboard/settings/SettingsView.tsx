"use client";

import { useState } from "react";
import { CHANNELS, DEFAULT_CHANNELS, type ChannelConfig, type ChannelId, type ChannelsState } from "@/lib/mock/settings";
import ChannelStrip from "./ChannelStrip";
import ChannelPanel from "./ChannelPanel";
import AiFlagCard from "./AiFlagCard";

/** Notification settings: pick a channel in the strip, configure it, send a test. Local state until the settings API exists. */
export default function SettingsView() {
  const [channels, setChannels] = useState<ChannelsState>(DEFAULT_CHANNELS);
  const [selected, setSelected] = useState<ChannelId>("whatsapp");
  const [aiOn, setAiOn] = useState(true);

  const meta = CHANNELS.find((c) => c.id === selected) ?? CHANNELS[0];
  const patch = (id: ChannelId, change: Partial<ChannelConfig>) =>
    setChannels((prev) => ({ ...prev, [id]: { ...prev[id], ...change } }));

  return (
    <main className="mx-auto max-w-[1440px] space-y-6 px-6 py-6 md:px-10 lg:px-16">
      <ChannelStrip channels={channels} selected={selected} onSelect={setSelected} />
      <ChannelPanel key={meta.id} meta={meta} config={channels[meta.id]} onChange={(change) => patch(meta.id, change)} />
      <AiFlagCard aiOn={aiOn} onChange={setAiOn} />
      <p className="px-1 font-aeonik-light text-[11px] leading-relaxed text-text-primary/50 dark:text-white/45">
        Demo mode: settings live in this tab only and test sends are simulated. They connect to the notifications API
        when it is ready.
      </p>
    </main>
  );
}
