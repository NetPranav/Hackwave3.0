"use client";

import { endpointsOf } from "@/lib/compare/catalog";
import { useSeismoData } from "@/lib/api/data";

export const SELECT_CLASS =
  "w-full cursor-pointer rounded border border-box-outline bg-dash-bg px-3 py-2 font-aeonik-mono text-xs text-text-primary focus:border-text-primary focus:outline-none dark:border-dark-border dark:bg-dark-dash-bg dark:text-white dark:focus:border-white";

/** Pick any monitored endpoint, grouped by service. */
export default function EndpointSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const ENDPOINTS = endpointsOf(useSeismoData().services);
  const services = [...new Set(ENDPOINTS.map((e) => e.serviceName))];
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="API call" className={SELECT_CLASS}>
      {services.map((name) => (
        <optgroup key={name} label={name}>
          {ENDPOINTS.filter((e) => e.serviceName === name).map((e) => (
            <option key={e.endpoint.id} value={e.endpoint.id}>
              {e.endpoint.method} {e.endpoint.path}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
