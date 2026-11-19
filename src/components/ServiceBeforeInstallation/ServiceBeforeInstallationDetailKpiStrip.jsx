"use client";

import { useMemo } from "react";
import {
  getTotalRegisteredDetailKpiCards,
  registeredInstallationFromKpiCardId,
  totalRegisteredKpiCardIdFromFilter,
} from "@/lib/serviceBeforeInstallationHub";
import ServiceBeforeInstallationKpiCard from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationKpiCard";

const COUNT_BY_CARD_ID = {
  "total-registered": (totals) => totals.total_registered ?? totals.total ?? 0,
  "registered-installation-pending": (totals) => totals.installation_pending ?? 0,
  "registered-installation-completed": (totals) => totals.installation_completed ?? 0,
};

export default function ServiceBeforeInstallationDetailKpiStrip({
  dashboardBase,
  registeredInstallation = "",
  totals = {},
  loading = false,
  onCardSelect,
}) {
  const cards = useMemo(() => getTotalRegisteredDetailKpiCards(dashboardBase), [dashboardBase]);
  const activeCardId = totalRegisteredKpiCardIdFromFilter(registeredInstallation);

  return (
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
      {cards.map((card) => {
        const pick = COUNT_BY_CARD_ID[card.id];
        const value = pick ? pick(totals) : 0;
        return (
          <ServiceBeforeInstallationKpiCard
            key={card.id}
            card={card}
            total={value}
            loading={loading}
            active={card.id === activeCardId}
            variant="compact"
            showTrend={false}
            onClick={
              onCardSelect
                ? () => {
                    const next = registeredInstallationFromKpiCardId(card.id);
                    const current = String(registeredInstallation || "").trim();
                    onCardSelect(current === next && next ? "" : next);
                  }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}