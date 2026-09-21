"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import SummaryStatCard from "@/components/sales/SummaryStatCard";

export default function VeryGoodCustomersCard() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const href = "/sales-dashboard/customers?filter=very_good_followup_today";

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await fetch("/api/card-data?period=today", {
          credentials: "include",
          cache: "no-store",
        });
        if (response.ok) {
          const data = await response.json();
          setCount(data.customersCount ?? 0);
        }
      } catch {
        setCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchCount();
  }, []);

  return (
    <SummaryStatCard
      href={href}
      label="Very Good Customers"
      count={count}
      suffix="Follow-up Today"
      icon={Users}
      iconWrapClass="bg-emerald-500"
      arrowClass="text-emerald-500"
      loading={loading}
    />
  );
}
