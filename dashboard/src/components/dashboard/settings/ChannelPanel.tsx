"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import RubberSegment, { type RubberSegmentItem } from "@/components/ui/RubberSegment";
import { Card } from "@/components/dashboard/Card";
import Switch from "@/components/dashboard/Switch";
import {
  THRESHOLD_LABEL,
  WHATSAPP_SANDBOX_STEPS,
  type ChannelConfig,
  type ChannelMeta,
  type ChatProvider,
  type Threshold,
} from "@/lib/mock/settings";
import { isConfigured } from "./channelState";
import TestSend from "./TestSend";

const THRESHOLD_ITEMS: RubberSegmentItem[] = (["all", "suspected", "breaking"] as Threshold[]).map((value) => ({
  value,
  label: THRESHOLD_LABEL[value].toUpperCase(),
}));

const INPUT =
  "w-full rounded border border-box-outline bg-dash-bg px-3 py-2 font-aeonik-mono text-xs text-text-primary placeholder:text-text-primary/40 focus:border-text-primary focus:outline-none dark:border-dark-border dark:bg-dark-dash-bg dark:text-white dark:placeholder:text-white/30 dark:focus:border-white";

const HINT: Record<ChannelMeta["id"], string> = {
  dashboard: "",
  github: "Use the form owner/repository.",
  whatsapp: "Include the country code, for example +91.",
  chat: "The webhook must start with https://.",
  email: "Enter a full address.",
};

interface ChannelPanelProps {
  meta: ChannelMeta;
  config: ChannelConfig;
  onChange: (patch: Partial<ChannelConfig>) => void;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45">
      {children}
    </span>
  );
}

function ChatProviderToggle({ value, onChange }: { value: ChatProvider; onChange: (v: ChatProvider) => void }) {
  return (
    <div className="inline-flex rounded border border-box-outline/70 p-0.5 font-aeonik-mono text-[11px] dark:border-dark-border">
      {(["slack", "discord"] as const).map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={value === p}
          onClick={() => onChange(p)}
          className={cn(
            "rounded px-3 py-1 uppercase transition-colors",
            value === p
              ? "bg-text-primary font-medium text-white dark:bg-white dark:text-black"
              : "text-text-primary/60 hover:text-text-primary dark:text-white/60 dark:hover:text-white"
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function SandboxSteps() {
  return (
    <div className="rounded border border-box-outline/70 bg-inset px-4 py-3 dark:border-dark-border dark:bg-dark-inset">
      <p className="font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/50 dark:text-white/45">
        Join the WhatsApp sandbox first
      </p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-4 font-aeonik-light text-xs leading-relaxed text-text-primary/75 dark:text-white/75">
        {WHATSAPP_SANDBOX_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

/** Settings for one channel: on/off, where to send, how serious a change must be, and a test. */
export default function ChannelPanel({ meta, config, onChange }: ChannelPanelProps) {
  const [reveal, setReveal] = useState(false);
  const ready = isConfigured(meta, config);
  const incomplete = config.value.trim().length > 0 && !ready;
  const chatName = config.chatProvider === "discord" ? "Discord" : "Slack";
  const displayName = meta.id === "chat" ? chatName : meta.name;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 md:p-6">
        <div className="min-w-0">
          <h2 className="font-aeonik text-2xl font-medium tracking-tight text-text-primary dark:text-white">{displayName}</h2>
          <p className="mt-1 max-w-xl font-aeonik-light text-sm leading-relaxed text-text-primary/70 dark:text-white/70">
            {meta.blurb}
          </p>
        </div>
        <label className="flex items-center gap-3 font-aeonik-mono text-xs text-text-primary/70 dark:text-white/70">
          {meta.locked ? "Always on" : config.enabled ? "Sending" : "Paused"}
          <Switch
            checked={config.enabled}
            onChange={(enabled) => onChange({ enabled })}
            label={"Send alerts to " + displayName}
            disabled={meta.locked}
          />
        </label>
      </div>

      <div className="space-y-6 border-t border-box-outline px-5 py-5 dark:border-dark-border md:px-6">
        {meta.id === "chat" && (
          <div className="space-y-2">
            <Label>Service</Label>
            <div>
              <ChatProviderToggle
                value={config.chatProvider ?? "slack"}
                onChange={(chatProvider) => onChange({ chatProvider })}
              />
            </div>
          </div>
        )}

        {meta.fieldLabel && (
          <div className="space-y-2">
            <Label>{meta.fieldLabel}</Label>
            <div className="flex items-center gap-2">
              <input
                type={meta.secret && !reveal ? "password" : "text"}
                value={config.value}
                onChange={(e) => onChange({ value: e.target.value })}
                placeholder={meta.placeholder}
                autoComplete="off"
                spellCheck={false}
                aria-label={meta.fieldLabel}
                className={INPUT}
              />
              {meta.secret && (
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  className="shrink-0 font-aeonik-mono text-[11px] uppercase tracking-wider text-text-primary/60 hover:text-text-primary dark:text-white/60 dark:hover:text-white"
                >
                  {reveal ? "Hide" : "Show"}
                </button>
              )}
            </div>
            {incomplete && (
              <p className="font-aeonik-mono text-[11px] text-warn dark:text-warn-bright">{HINT[meta.id]}</p>
            )}
            {meta.secret && (
              <p className="font-aeonik-mono text-[11px] text-text-primary/50 dark:text-white/45">
                Treated as a secret: hidden by default and never shown in alerts.
              </p>
            )}
          </div>
        )}

        {meta.id === "whatsapp" && <SandboxSteps />}

        <div className="space-y-2">
          <Label>Alert me about</Label>
          <RubberSegment
            items={THRESHOLD_ITEMS}
            value={config.threshold}
            onChange={(v) => onChange({ threshold: v as Threshold })}
            size="sm"
            radius={6}
            inset={2}
            equalSlots={false}
            stretch={50}
            squash={2}
            speed={1}
            trackColor="var(--rs-track-theme)"
            thumbColor="var(--rs-thumb-theme)"
            textColor="var(--rs-ink-theme)"
            activeTextColor="var(--rs-ink-active-theme)"
            className="font-aeonik-mono text-[11px] uppercase tracking-wider"
            aria-label="Severity threshold"
          />
        </div>
      </div>

      <div className="border-t border-box-outline px-5 py-4 dark:border-dark-border md:px-6">
        <TestSend
          channelName={displayName}
          channels={meta.id === "chat" ? [config.chatProvider === "discord" ? "discord" : "slack"] : [meta.id]}
          disabled={!config.enabled || !ready}
          disabledReason={!config.enabled ? "Turn the channel on to send a test." : "Finish the setup above to send a test."}
        />
      </div>
    </Card>
  );
}
