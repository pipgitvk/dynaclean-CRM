"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DollarSign } from "lucide-react";
import dayjs from "dayjs";

export default function PaymentPendingButton() {
  const [overdueCount, setOverdueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch payment pending data
        const reportRes = await fetch("/api/reports/payment-pending");
        if (reportRes.ok) {
          const { orders } = await reportRes.json();
          
          // Count only overdue orders (due_date < today)
          const overdue = orders.filter(order => {
            return dayjs(order.due_date).isBefore(dayjs(), 'day');
          });
          
          setOverdueCount(overdue.length);
        } else {
          console.error("Failed to fetch payment pending report");
        }
      } catch (error) {
        console.error("Error fetching payment pending data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Refresh count every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Don't render while loading
  if (loading) return null;

  return (
    <Link
      href="/sales-dashboard/reports/payment-pending"
      className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 sm:gap-2 bg-red-600 text-white text-[10px] sm:text-xs font-medium rounded-lg hover:bg-red-700 transition-colors shrink-0 whitespace-nowrap relative"
    >
      <DollarSign size={14} className="sm:w-4 sm:h-4" />
      <span className="hidden sm:inline">Payment Pending</span>
      <span className="sm:hidden">Pending</span>
      {overdueCount > 0 && (
        <span className="ml-1 inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 text-[9px] sm:text-xs font-bold bg-white text-red-600 rounded-full">
          {overdueCount > 99 ? "99+" : overdueCount}
        </span>
      )}
    </Link>
  );
}
