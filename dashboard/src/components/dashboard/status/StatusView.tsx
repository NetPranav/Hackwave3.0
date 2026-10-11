"use client";

import { useState } from "react";
import { SERVICES_STATUS_DATA } from "@/lib/mock/status";
import ProviderStrip from "./ProviderStrip";
import ServiceHeader from "./ServiceHeader";
import EndpointFields from "./EndpointFields";
import { STATE_META } from "./StateLabel";

// Worst first, original order kept within a state.
const SERVICES = SERVICES_STATUS_DATA.map((svc, i) => ({ svc, i }))
  .sort((a, b) => STATE_META[a.svc.state].rank - STATE_META[b.svc.state].rank || a.i - b.i)
  .map(({ svc }) => svc);

/** API status: pick an API in the strip, read what changed, then see the field-level evidence. */
export default function StatusView({ initialService }: { initialService?: string }) {
  const [selectedId, setSelectedId] = useState(
    () => SERVICES.find((s) => s.slug === initialService || s.id === initialService)?.id ?? SERVICES[0].id
  );
  const [endpointIndex, setEndpointIndex] = useState(0);

  const service = SERVICES.find((s) => s.id === selectedId) ?? SERVICES[0];

  return (
    <main className="mx-auto max-w-[1440px] space-y-6 px-6 py-6 md:px-10 lg:px-16">
      <ProviderStrip
        services={SERVICES}
        selectedId={service.id}
        onSelect={(id) => {
          setSelectedId(id);
          setEndpointIndex(0);
        }}
      />
      <ServiceHeader service={service} />
      <EndpointFields endpoints={service.endpoints} index={endpointIndex} onIndexChange={setEndpointIndex} />
    </main>
  );
}
