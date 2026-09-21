"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import SummaryStatCard from "@/components/sales/SummaryStatCard";

export default function VeryGoodCustomersCard({
  href = "/sales-dashboard/customers?status=Very%20Good",
}) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await fetch("/api/card-data", {
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
      suffix="Customers"
      icon={Users}
      iconWrapClass="bg-emerald-500"
      arrowClass="text-emerald-500"
      loading={loading}
    />
  );
}
