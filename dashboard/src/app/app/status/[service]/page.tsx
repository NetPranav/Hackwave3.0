import { Suspense } from "react";
import StatusView from "@/components/dashboard/status/StatusView";
import PageFallback from "@/components/dashboard/PageFallback";

interface Props {
  params: Promise<{ service: string }>;
}

async function ServiceContent({ params }: Props) {
  const { service } = await params;
  return <StatusView initialService={service} />;
}

export default function ServiceStatusDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<PageFallback label="Loading API status" />}>
      <ServiceContent params={params} />
    </Suspense>
  );
}
