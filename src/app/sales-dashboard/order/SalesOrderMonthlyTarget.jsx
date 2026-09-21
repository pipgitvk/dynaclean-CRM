"use client";

import { useSearchParams } from "next/navigation";
import SalesAchievedQuickCard from "@/components/targets/SalesAchievedQuickCard";

export default function SalesOrderMonthlyTarget() {
  const searchParams = useSearchParams();
  const showTarget =
    searchParams.get("has_invoice") === "1" &&
    Boolean(searchParams.get("date_from")) &&
    Boolean(searchParams.get("date_to"));

  if (!showTarget) return null;

  return (
    <div className="mb-4 max-w-md">
      <SalesAchievedQuickCard />
    </div>
  );
}
