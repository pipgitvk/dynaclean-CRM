"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import dayjs from "dayjs";

export default function OverduePaymentCard() {
  const [overdueCount, setOverdueCount] = useState(0);
  const [totalOverdueAmount, setTotalOverdueAmount] = useState("0");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch payment pending data
        const reportRes = await fetch("/api/reports/payment-pending");
        if (reportRes.ok) {
          const { orders } = await reportRes.json();
          
          // Filter only overdue orders (due_date < today)
          const overdue = orders.filter(order => {
            return dayjs(order.due_date).isBefore(dayjs(), 'day');
          });
          
          setOverdueCount(overdue.length);
          
          // Calculate total overdue amount
          const total = overdue.reduce((sum, order) => sum + order.remaining_amount, 0);
          setTotalOverdueAmount(total.toFixed(2));
        } else {
          console.error("Failed to fetch payment pending report");
        }
      } catch (error) {
        console.error("Error fetching overdue payment data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Refresh count every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-red-500 via-pink-500 to-red-600 rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 md:p-6 text-white animate-pulse min-h-[160px]">
        <div className="h-full bg-white/10 rounded"></div>
      </div>
    );
  }

  return (
    <Link
      href="/admin-dashboard/reports/payment-pending"
      className="bg-gradient-to-br from-red-500 via-pink-500 to-red-600 rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 md:p-6 text-white block hover:shadow-xl hover:scale-105 transform duration-200 transition-all"
    >
      <div className="flex flex-col h-full justify-between min-h-[160px]">
        <div>
          <div className="flex items-center gap-2 sm:gap-3">
            <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-white shrink-0" />
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-tight tracking-tight">
              <span className="block">Overdue</span>
              <span className="block">Payments</span>
            </h2>
          </div>
          <p className="mt-2 sm:mt-3 text-2xl sm:text-3xl md:text-4xl font-bold">
            ₹{parseFloat(totalOverdueAmount).toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-sm sm:text-base font-semibold text-white/90">
            {overdueCount} order{overdueCount !== 1 ? "s" : ""} overdue
          </p>
        </div>
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/20">
          <span className="inline-block px-4 py-2 bg-white text-red-600 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg">
            View Details →
          </span>
        </div>
      </div>
    </Link>
  );
}
