"use client";

import { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import dayjs from "dayjs";
import SummaryStatCard from "@/components/sales/SummaryStatCard";

export default function ServiceSupportTodayReportCard({
  href = "/user-dashboard/service-support-report",
}) {
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const today = dayjs();
        const params = new URLSearchParams({
          startDate: today.startOf("day").toISOString(),
          endDate: today.endOf("day").toISOString(),
        });

        const [modulesRes, dataRes] = await Promise.all([
          fetch("/api/my-modules"),
          fetch(`/api/service-support-report?${params}`),
        ]);

        if (modulesRes.ok) {
          const { allowedModules } = await modulesRes.json();
          if (
            allowedModules !== null &&
            !allowedModules.includes("service-support-report")
          ) {
            setAllowed(false);
            return;
          }
        }

        if (dataRes.ok) {
          const data = await dataRes.json();
          const s = data.summary || {};
          const total =
            (s.clientFollowups || 0) +
            (s.complaintsReceived || 0) +
            (s.complaintsResolved || 0) +
            (s.complaintsPending || 0) +
            (s.quotations || 0) +
            (s.ordersProcessed || 0) +
            (s.upcomingInstallations || 0) +
            (s.overdueInstallations || 0) +
            (s.warrantyRegistered || 0) +
            (s.warrantyPending || 0);
          setCount(total);
        }
      } catch {
        setCount(0);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (!loading && !allowed) return null;

  return (
    <SummaryStatCard
      href={href}
      label="Today Report"
      count={count}
      suffix="Activities"
      icon={FileText}
      iconWrapClass="bg-teal-500"
      arrowClass="text-teal-500"
      loading={loading}
    />
  );
}
