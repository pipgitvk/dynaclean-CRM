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
    totals.delivered_installation_pending,
  "open-installation-delivery-pending": (totals) => totals.delivery_pending_after_dispatch,
  "open-installation-planned": (totals) => totals.installation_planned,
  "open-installation-completed": (totals) => totals.completed_installation,
  "open-installation-feedback-collected": (totals) => totals.feedback_collected,
};

function cardHasSettledCount(value) {
  if (value == null || value === "") return false;
  return Number.isFinite(Number(value));
}

export default function ServiceBeforeInstallationOpenInstallationKpiStrip({
  openInstallationBucket = "",
  totals = {},
  loading = false,
  plannedLoading = false,
  deliveryPendingLoading = false,
  completedLoading = false,
  noFeedbackLoading = false,
  onCardSelect,
}) {
  const cards = useMemo(() => getOpenInstallationDetailKpiCards(), []);
  const activeCardId = openInstallationKpiCardIdFromFilter(openInstallationBucket);

  return (
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 lg:gap-4">
      {cards.map((card) => {
        const pick = COUNT_BY_CARD_ID[card.id];
        const value = pick ? pick(totals) : null;
        const settled = cardHasSettledCount(value);
        const loadingFlag =
          card.id === "open-installation-feedback-collected"
            ? noFeedbackLoading
            : card.id === "open-installation-planned"
              ? plannedLoading
              : card.id === "open-installation-delivery-pending"
                ? deliveryPendingLoading
                : card.id === "open-installation-completed"
                  ? completedLoading
                  : loading;
        const cardLoading = Boolean(loadingFlag) && !(settled && Number(value) > 0);
        return (
          <ServiceBeforeInstallationKpiCard
            key={card.id}
            card={card}
            total={settled ? Number(value) : null}
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
