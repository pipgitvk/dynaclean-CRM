"use client";

import { useMemo } from "react";
import {
  getOpenInstallationDetailKpiCards,
  openInstallationBucketFromKpiCardId,
  openInstallationKpiCardIdFromFilter,
} from "@/lib/serviceBeforeInstallationHub";
import ServiceBeforeInstallationKpiCard from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationKpiCard";

const COUNT_BY_CARD_ID = {
  "open-installation-delivered-pending": (totals) =>
    totals.delivered_installation_pending ?? 0,
  "open-installation-delivery-pending": (totals) => totals.delivery_pending_after_dispatch ?? 0,
  "open-installation-completed": (totals) => totals.completed_installation ?? 0,
  "open-installation-feedback-collected": (totals) => totals.feedback_collected ?? 0,
};

export default function ServiceBeforeInstallationOpenInstallationKpiStrip({
  openInstallationBucket = "",
  totals = {},
  loading = false,
  noFeedbackLoading = false,
  onCardSelect,
}) {
  const cards = useMemo(() => getOpenInstallationDetailKpiCards(), []);
  const activeCardId = openInstallationKpiCardIdFromFilter(openInstallationBucket);

  return (
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
      {cards.map((card) => {
        const pick = COUNT_BY_CARD_ID[card.id];
        const value = pick ? pick(totals) : 0;
        const cardLoading =
          card.id === "open-installation-feedback-collected"
            ? loading || noFeedbackLoading
            : loading;
        return (
          <ServiceBeforeInstallationKpiCard
            key={card.id}
            card={card}
            total={value}
            loading={cardLoading}
            active={card.id === activeCardId}
            variant="compact"
            showTrend={false}
            onClick={
              onCardSelect
                ? () => {
                    const next = openInstallationBucketFromKpiCardId(card.id);
                    const current = String(openInstallationBucket || "").trim();
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
