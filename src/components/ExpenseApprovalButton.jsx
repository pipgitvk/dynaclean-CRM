"use client";

import { useState, useEffect } from "react";
import { Wallet } from "lucide-react";
import SummaryStatCard from "@/components/sales/SummaryStatCard";

export default function ExpenseApprovalButton({ variant = "default" }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [hasReportees, setHasReportees] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingExpenses();
  }, []);

  const fetchPendingExpenses = async () => {
    try {
      const res = await fetch("/api/empcrm/reporting-manager-status");
      const data = await res.json();
      if (data.success && data.hasReportees) {
        setHasReportees(true);
        setPendingCount(data.pendingExpensesCount || 0);
      }
    } catch (e) {
      console.error("Error fetching pending expenses:", e);
    } finally {
      setLoading(false);
    }
  };

  if (variant === "sales") {
    if (loading) {
      return (
        <SummaryStatCard
          href="/empcrm/user-dashboard/employee-expenses"
          label="Expenses"
          count={0}
          suffix="Pending"
          icon={Wallet}
          iconWrapClass="bg-emerald-500"
          arrowClass="text-emerald-500"
          loading
        />
      );
    }
    if (!hasReportees) return null;
    return (
      <SummaryStatCard
        href="/empcrm/user-dashboard/employee-expenses"
        label="Expenses"
        count={pendingCount}
        suffix="Pending"
        icon={Wallet}
        iconWrapClass="bg-emerald-500"
        arrowClass="text-emerald-500"
      />
    );
  }

  // Don't show if no reportees or loading
  if (loading || !hasReportees) return null;

  return (
    <button
      onClick={() => (window.location.href = "/empcrm/user-dashboard/employee-expenses")}
      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-md hover:shadow-lg"
    >
      <Wallet size={18} />
      <span className="text-sm font-medium">
        Expenses 
        {pendingCount > 0 && (
          <span className="ml-2 px-2 py-0.5 bg-white text-emerald-600 rounded-full text-xs font-bold">
            {pendingCount}
          </span>
        )}
      </span>
    </button>
  );
}
