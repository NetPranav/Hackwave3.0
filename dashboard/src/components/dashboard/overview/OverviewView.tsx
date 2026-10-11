"use client";

import { useState } from "react";
import KpiStrip from "./KpiStrip";
import AttentionBar from "./AttentionBar";
import MetricChart from "./MetricChart";
import ServicesTable, { type TableFilter } from "./ServicesTable";

/** The overview: four numbers, what needs you, the trend, and every API. The KPI tiles filter the table. */
export default function OverviewView() {
  const [filter, setFilter] = useState<TableFilter>("all");

  const filterAndScroll = (next: TableFilter) => {
    setFilter(next);
    document.getElementById("services")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main id="top" className="mx-auto max-w-[1440px] space-y-6 px-6 py-6 md:px-10 lg:px-16">
      <KpiStrip onFilter={filterAndScroll} />
      <AttentionBar />
      <MetricChart />
      <ServicesTable filter={filter} onFilterChange={setFilter} />
    </main>
  );
}
