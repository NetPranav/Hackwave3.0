"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/dashboard/Card";
import Sparkline from "@/components/dashboard/Sparkline";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import type { ServiceStatusItem } from "@/lib/mock/status";
import StateLabel from "./StateLabel";

interface ProviderStripProps {
  services: ServiceStatusItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}

/** One cell per API, worst first. It is also the service selector, so you see which API is unhealthy before reading. */
export default function ProviderStrip({ services, selectedId, onSelect }: ProviderStripProps) {
  return (
    <Card aria-label="Monitored APIs">
      <div className="overflow-x-auto">
        <ul className="grid min-w-max grid-flow-col auto-cols-[minmax(172px,1fr)] divide-x divide-box-outline dark:divide-dark-border lg:min-w-0">
          {services.map((svc) => {
            const isSelected = svc.id === selectedId;
            return (
              <li key={svc.id}>
                <button
                  type="button"
                  onClick={() => onSelect(svc.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "group block h-full w-full border-b-2 px-5 py-4 text-left transition-colors",
                    isSelected
                      ? "border-b-text-primary bg-dash-bg/60 dark:border-b-white dark:bg-white/[0.04]"
                      : "border-b-transparent hover:bg-dash-bg/40 dark:hover:bg-white/[0.02]"
                  )}
                >
                  <StateLabel state={svc.state} />
                  <div className="mt-2 truncate font-aeonik text-base font-medium text-text-primary dark:text-white">
                    {svc.name}
                  </div>
                  <div className="mt-3 flex items-center gap-2.5 font-aeonik-mono text-[11px] text-text-primary/60 dark:text-white/60">
                    <Sparkline values={svc.sparkline} />
                    <span className="inline-flex items-end gap-1">
                      <AnimatedNumber value={svc.callsPerMin} grouped size={11} />
                      <span>req/m</span>
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
