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
      <div className="bg-white rounded-lg shadow-md p-4 text-black animate-pulse border-l-4 border-red-500 min-h-[140px]">
        <div className="h-full bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <Link
      href="/admin-dashboard/reports/payment-pending"
      className="bg-white rounded-lg shadow-md p-4 text-black block hover:shadow-lg transition-shadow h-full cursor-pointer border-l-4 border-red-500 min-h-[140px]"
    >
      <div className="flex flex-col h-full justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <h2 className="text-sm font-bold text-black leading-tight">
              Overdue Payments
            </h2>
          </div>
          <p className={`text-2xl font-bold mt-1 ${parseFloat(totalOverdueAmount) === 0 ? 'text-green-600' : 'text-red-600'}`}>
            ₹{parseFloat(totalOverdueAmount).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            {overdueCount} order{overdueCount !== 1 ? "s" : ""} overdue
          </p>
        </div>
      </div>
    </Link>
  );
}
