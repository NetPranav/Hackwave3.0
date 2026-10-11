import { Suspense } from "react";
import GraphView from "@/components/dashboard/graph/GraphView";
import PageFallback from "@/components/dashboard/PageFallback";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Other pages link here with ?highlight=<service slug> to open the graph with that service selected. */
async function GraphContent({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const highlight = Array.isArray(sp.highlight) ? sp.highlight[0] : sp.highlight;
  return <GraphView highlight={highlight} />;
}

export default function GraphPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageFallback label="Loading the dependency graph" />}>
      <GraphContent searchParams={searchParams} />
    </Suspense>
  );
}
