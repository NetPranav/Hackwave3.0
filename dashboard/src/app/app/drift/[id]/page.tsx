import { Suspense } from "react";
import DriftView from "@/components/dashboard/drift/DriftView";
import PageFallback from "@/components/dashboard/PageFallback";

interface Props {
  params: Promise<{ id: string }>;
}

async function DriftContent({ params }: Props) {
  const { id } = await params;
  return <DriftView id={id} />;
}

export default function DriftInspectorPage({ params }: Props) {
  return (
    <Suspense fallback={<PageFallback label="Loading change details" />}>
      <DriftContent params={params} />
    </Suspense>
  );
}
