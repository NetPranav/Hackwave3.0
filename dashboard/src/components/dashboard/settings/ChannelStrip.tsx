"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/dashboard/Card";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import { CHANNELS, THRESHOLD_LABEL, type ChannelId, type ChannelsState } from "@/lib/mock/settings";
import { STATUS_DOT, STATUS_LABEL, STATUS_TEXT, statusOf } from "./channelState";

interface ChannelStripProps {
  channels: ChannelsState;
  selected: ChannelId;
  onSelect: (id: ChannelId) => void;
}

/** How many channels will actually reach you, and one cell per channel to open its settings. */
export default function ChannelStrip({ channels, selected, onSelect }: ChannelStripProps) {
  const active = CHANNELS.filter((c) => statusOf(c, channels[c.id]) === "on").length;

  return (
    <Card>
      <div className="p-5 md:p-6">
        <span className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45">
          Where alerts reach you
        </span>
        <div className="mt-3 flex items-baseline gap-3">
          <AnimatedNumber value={active} size={44} weight={500} className="font-aeonik tracking-tight" />
          <span className="font-aeonik-light text-sm text-text-primary/70 dark:text-white/70">
            of {CHANNELS.length} channels are on and set up
          </span>
        </div>
        <p className="mt-2 text-xs text-text-primary/60 dark:text-white/60">
          One alert per change per channel. Each channel has its own severity threshold.
        </p>
      </div>

      <ul className="grid grid-cols-2 divide-x divide-y divide-box-outline border-t border-box-outline dark:divide-dark-border dark:border-dark-border lg:grid-cols-5 lg:divide-y-0">
        {CHANNELS.map((meta) => {
          const cfg = channels[meta.id];
          const status = statusOf(meta, cfg);
          const isSelected = meta.id === selected;
          return (
            <li key={meta.id}>
              <button
                type="button"
                onClick={() => onSelect(meta.id)}
                aria-pressed={isSelected}
                className={cn(
                  "block h-full w-full border-b-2 px-5 py-4 text-left transition-colors",
                  isSelected
                    ? "border-b-text-primary bg-dash-bg/60 dark:border-b-white dark:bg-white/[0.04]"
                    : "border-b-transparent hover:bg-dash-bg/40 dark:hover:bg-white/[0.02]"
                )}
              >
                <span className={cn("inline-flex items-center gap-1.5 font-aeonik-mono text-[10px] font-medium tracking-wider", STATUS_TEXT[status])}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
                  {STATUS_LABEL[status]}
                </span>
                <span className="mt-2 block font-aeonik text-base font-medium text-text-primary dark:text-white">
                  {meta.name}
                </span>
                <span className="mt-1 block font-aeonik-mono text-[11px] text-text-primary/50 dark:text-white/45">
                  {status === "off" ? "Not sending" : THRESHOLD_LABEL[cfg.threshold]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
