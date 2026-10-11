import { Suspense } from "react";
import CompareView, { type CompareInitial } from "@/components/dashboard/compare/CompareView";
import PageFallback from "@/components/dashboard/PageFallback";
import type { ChangeKind } from "@/lib/compare/simulate";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const KINDS: ChangeKind[] = ["rename", "scale", "enum", "cap"];
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Radar and other pages can link here pre-filled: ?mode=simulate&endpoint=ep_users_id&change=rename&field=name&value=display_name */
async function CompareContent({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const change = first(sp.change);
  const initial: CompareInitial = {
    mode: first(sp.mode) === "simulate" ? "simulate" : "compare",
    endpoint: first(sp.endpoint),
    kind: KINDS.find((k) => k === change),
    field: first(sp.field),
    value: first(sp.value),
  };
  return <CompareView initial={initial} />;
}

export default function ComparePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageFallback label="Loading compare" />}>
      <CompareContent searchParams={searchParams} />
    </Suspense>
  );
}
