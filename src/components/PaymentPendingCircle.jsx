"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DollarSign, ArrowRight } from "lucide-react";
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
      className="group flex h-[82px] min-w-[180px] items-center gap-3 rounded-2xl border border-rose-200 bg-white px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[11px] font-medium text-slate-500">Payment Pending</span>
        <span className="text-2xl font-bold leading-tight text-slate-800">{overdueCount > 99 ? "99+" : overdueCount}</span>
        <span className="text-[11px] text-slate-400">Pending</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-xl bg-rose-100 p-2 text-rose-600">
          <DollarSign size={16} />
        </div>
        <ArrowRight size={12} className="text-rose-500 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
