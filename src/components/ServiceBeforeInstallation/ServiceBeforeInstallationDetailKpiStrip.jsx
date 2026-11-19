"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { getServiceBeforeInstallationCards } from "@/lib/serviceBeforeInstallationHub";
import ServiceBeforeInstallationKpiCard from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationKpiCard";

const STRIP_SEGMENT_IDS = [
  "total-registered",
  "open-installation",
  "open-completions",
  "overdue-delayed-installation",
];

function pctChange(current, previous) {
  if (previous === undefined || previous === null) return null;
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

export default function ServiceBeforeInstallationDetailKpiStrip({
  dashboardBase,
  activeSegment,
}) {
  const cards = useMemo(() => {
    const all = getServiceBeforeInstallationCards(dashboardBase);
    return STRIP_SEGMENT_IDS.map((id) => all.find((c) => c.id === id)).filter(Boolean);
  }, [dashboardBase]);

  const [counts, setCounts] = useState({});
  const [prevCounts, setPrevCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios
      .get("/api/service-before-installation/hub")
      .then((res) => {
        if (!cancelled && res.data?.success) {
          setCounts(res.data.counts || {});
          setPrevCounts(res.data.prevCounts || {});
        }
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <ServiceBeforeInstallationKpiCard
          key={card.id}
          card={card}
          total={counts[card.countKey] ?? 0}
          changePct={pctChange(counts[card.countKey], prevCounts[card.countKey])}
          loading={loading}
          active={card.id === activeSegment}
          variant="compact"
        />
      ))}
    </div>
  );
}