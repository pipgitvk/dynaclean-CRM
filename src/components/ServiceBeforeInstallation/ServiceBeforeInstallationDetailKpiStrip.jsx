"use client";

import { useMemo } from "react";
import { getServiceBeforeInstallationCards } from "@/lib/serviceBeforeInstallationHub";
import ServiceBeforeInstallationKpiCard from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationKpiCard";

/** Detail pages: only show the active segment KPI (Total Registered on that route). */
const STRIP_SEGMENT_IDS = ["total-registered"];

export default function ServiceBeforeInstallationDetailKpiStrip({
  dashboardBase,
  activeSegment,
  total = 0,
  loading = false,
}) {
  const cards = useMemo(() => {
    const all = getServiceBeforeInstallationCards(dashboardBase);
    return STRIP_SEGMENT_IDS.map((id) => all.find((c) => c.id === id)).filter(Boolean);
  }, [dashboardBase]);

  return (
    <div className="mb-5 max-w-sm">
      {cards.map((card) => (
        <ServiceBeforeInstallationKpiCard
          key={card.id}
          card={card}
          total={total}
          loading={loading}
          active={card.id === activeSegment}
          variant="compact"
          showTrend={false}
        />
      ))}
    </div>
  );
}