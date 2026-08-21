"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DollarSign } from "lucide-react";
import dayjs from "dayjs";
import SummaryStatCard from "@/components/sales/SummaryStatCard";

export default function PaymentPendingButton({
  variant = "default",
  monthly = false,
}) {
  const [overdueCount, setOverdueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const reportRes = await fetch("/api/reports/payment-pending");
        if (reportRes.ok) {
          const { orders } = await reportRes.json();
          const monthStart = dayjs().startOf("month");
          const monthEnd = dayjs().endOf("month");
          const overdue = orders.filter((order) => {
            const isOverdue = dayjs(order.due_date).isBefore(dayjs(), "day");
            if (!isOverdue) return false;
            if (!monthly) return true;
            const createdAt = order.created_at
              ? dayjs(order.created_at)
              : null;
            return (
              createdAt &&
              !createdAt.isBefore(monthStart, "day") &&
              !createdAt.isAfter(monthEnd, "day")
            );
          });
          setOverdueCount(overdue.length);
        }
      } catch (error) {
        console.error("Error fetching payment pending data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [monthly]);

  if (variant === "sales") {
    return (
      <SummaryStatCard
        href="/sales-dashboard/reports/payment-pending"
        label="Payment Pending"
        count={overdueCount}
        suffix={monthly ? dayjs().format("MMM YYYY") : "Pending"}
        icon={DollarSign}
        iconWrapClass="bg-red-500"
        arrowClass="text-red-500"
        loading={loading}
      />
    );
  }

  if (loading) return null;

  return (
    <Link
      href="/sales-dashboard/reports/payment-pending"
      className="relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-red-600 px-2 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-red-700 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs"
    >
      <DollarSign size={14} className="sm:h-4 sm:w-4" />
      <span className="hidden sm:inline">Payment Pending</span>
      <span className="sm:hidden">Pending</span>
      {overdueCount > 0 && (
        <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-bold text-red-600 sm:h-6 sm:w-6 sm:text-xs">
          {overdueCount > 99 ? "99+" : overdueCount}
        </span>
      )}
    </Link>
  );
}
