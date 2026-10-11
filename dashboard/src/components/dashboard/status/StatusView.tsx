"use client";

import { useState } from "react";
import EmptyState from "@/components/dashboard/EmptyState";
import { useSeismoData } from "@/lib/api/data";
import ProviderStrip from "./ProviderStrip";
import ServiceHeader from "./ServiceHeader";
import EndpointFields from "./EndpointFields";
import { STATE_META } from "./StateLabel";

/** API status: pick an API in the strip, read what changed, then see the field-level evidence. */
export default function StatusView({ initialService }: { initialService?: string }) {
  const data = useSeismoData();
  // Worst first, original order kept within a state.
  const SERVICES = data.services
    .map((svc, i) => ({ svc, i }))
    .sort((a, b) => STATE_META[a.svc.state].rank - STATE_META[b.svc.state].rank || a.i - b.i)
    .map(({ svc }) => svc);
  const [selectedId, setSelectedId] = useState<string | undefined>(initialService);
  const [endpointIndex, setEndpointIndex] = useState(0);

  const service = SERVICES.find((s) => s.id === selectedId || s.slug === selectedId) ?? SERVICES[0];
  if (!service)
    return (
      <EmptyState
        loading={data.loading}
        label="API status"
        title="No API traffic yet"
        body="Status appears when an app with the Seismo SDK sends traffic. Create an SDK key in Settings, set SEISMO_KEY in your app, then make a few API calls (npm run demo:traffic for the demo shop)."
        action={{ href: "/app/settings", text: "Create an SDK key" }}
      />
    );

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
