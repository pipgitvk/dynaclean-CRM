"use client";

import { useMemo } from "react";
import {
  activeWarrantyKpiCardIdFromFilter,
  getActiveWarrantyDetailKpiCards,
  warrantyBucketFromKpiCardId,
} from "@/lib/serviceBeforeInstallationHub";
import ServiceBeforeInstallationKpiCard from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationKpiCard";

function cardHasSettledCount(value) {
  if (value == null || value === "") return false;
  return Number.isFinite(Number(value));
}

export default function ServiceBeforeInstallationActiveWarrantyKpiStrip({
  warrantyBucket = "active",
  totals = {},
  loading = false,
  onCardSelect,
}) {
  const cards = useMemo(() => getActiveWarrantyDetailKpiCards(), []);
  const activeCardId = activeWarrantyKpiCardIdFromFilter(warrantyBucket);

  return (
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
      {cards.map((card) => {
        const value = totals[card.field];
        const settled = cardHasSettledCount(value);
        const cardLoading = Boolean(loading) && !(settled && Number(value) > 0);
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
                    const next = warrantyBucketFromKpiCardId(card.id);
                    const current = String(warrantyBucket || "active").trim();
                    if (next === current) return;
                    onCardSelect(next);
                  }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}