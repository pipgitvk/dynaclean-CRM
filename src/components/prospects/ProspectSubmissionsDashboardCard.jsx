"use client";

import { Users } from "lucide-react";
import SummaryStatCard from "@/components/sales/SummaryStatCard";

export function ProspectReviewDashboardCard({
  href,
  title,
  count = 0,
  loading = false,
}) {
  return (
    <SummaryStatCard
      href={href}
      label={title}
      count={count}
      suffix="Pending review"
      icon={Users}
      iconWrapClass="bg-violet-500"
      arrowClass="text-violet-500"
      loading={loading}
    />
  );
}
