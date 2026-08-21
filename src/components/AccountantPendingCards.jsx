"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Wallet, Clock, ClipboardList, Receipt, AlertTriangle, DollarSign, CreditCard } from "lucide-react";

const CARDS = [
  {
    key: "invoicePending",
    label: "Invoice Pending",
    icon: FileText,
    href: "/accounts-dashboard/order?status=pendinginvoice&fromCard=1",
  },
  {
    key: "unsettledPayment",
    label: "Unsettled Payment",
    icon: Wallet,
    href: "/admin-dashboard/statements?status=Unsettled&fromCard=1",
  },
  {
    key: "paymentPending",
    label: "Payment Pending",
    icon: Clock,
    href: "/accounts-dashboard/reports/payment-pending?fromCard=1",
  },
  {
    key: "taskPending",
    label: "Task Pending",
    icon: ClipboardList,
    href: "/accounts-dashboard/task-manager?status=Pending&fromCard=1",
  },
  {
    key: "expensePaymentPending",
    label: "Expense Payment Pending",
    icon: Receipt,
    href: "/accounts-dashboard/all-expenses?status=Approved&linking=unlinked&fromCard=1",
  },
  {
    key: "expenseApprovePending",
    label: "Expense Approve Pending",
    icon: Receipt,
    href: "/accounts-dashboard/all-expenses?status=Pending&fromCard=1",
  },
  {
    key: "ddEmdOverdueCount",
    label: "DD/EMD Overdue Nos",
    icon: AlertTriangle,
    href: "/accounts-dashboard/dd-management?status=overdue&fromCard=1",
  },
  {
    key: "ddEmdOverdueValue",
    label: "DD/EMD Overdue Value",
    icon: DollarSign,
    href: "/accounts-dashboard/dd-management?status=overdue&fromCard=1",
    isAmount: true,
  },
  {
    key: "ddEmdTotalAmount",
    label: "DD/EMD Total Amount",
    icon: CreditCard,
    href: "/accounts-dashboard/dd-management?fromCard=1",
    isAmount: true,
  },
];

export default function AccountantPendingCards() {
  const router = useRouter();
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const amountFormatter = new Intl.NumberFormat("en-IN");

  const cardThemes = {
    invoicePending: {
      iconWrap: "bg-rose-100 text-rose-600",
      value: "text-rose-600",
      card: "border-rose-100 bg-white",
    },
    unsettledPayment: {
      iconWrap: "bg-red-100 text-red-600",
      value: "text-red-600",
      card: "border-red-100 bg-white",
    },
    paymentPending: {
      iconWrap: "bg-amber-100 text-amber-600",
      value: "text-amber-600",
      card: "border-amber-100 bg-white",
    },
    taskPending: {
      iconWrap: "bg-violet-100 text-violet-600",
      value: "text-violet-600",
      card: "border-violet-100 bg-white",
    },
    expensePaymentPending: {
      iconWrap: "bg-indigo-100 text-indigo-600",
      value: "text-indigo-600",
      card: "border-indigo-100 bg-white",
    },
    expenseApprovePending: {
      iconWrap: "bg-blue-100 text-blue-600",
      value: "text-blue-600",
      card: "border-blue-100 bg-white",
    },
    ddEmdOverdueCount: {
      iconWrap: "bg-emerald-100 text-emerald-600",
      value: "text-emerald-600",
      card: "border-emerald-100 bg-emerald-50/40",
    },
    ddEmdOverdueValue: {
      iconWrap: "bg-teal-100 text-teal-600",
      value: "text-teal-600",
      card: "border-teal-100 bg-teal-50/40",
    },
    ddEmdTotalAmount: {
      iconWrap: "bg-orange-100 text-orange-600",
      value: "text-orange-600",
      card: "border-orange-100 bg-orange-50/40",
    },
  };

  useEffect(() => {
    fetch("/api/accounts/today-report-counts")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setCounts(res.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-800">Summary</h3>
      </div>
      
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 2xl:grid-cols-9">
        {CARDS.map(({ key, label, icon: Icon, href, isAmount }) => {
          const value = counts?.[key] ?? 0;
          const theme = cardThemes[key] || {
            iconWrap: "bg-slate-100 text-slate-600",
            value: "text-slate-700",
            card: "border-slate-100 bg-white",
          };
          const displayValue = isAmount
            ? `₹${amountFormatter.format(Number(value || 0))}`
            : value;
          
          return (
            <div
              key={key}
              onClick={() => router.push(href)}
              className={`group cursor-pointer rounded-xl border p-2.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${theme.card}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform group-hover:scale-105 ${theme.iconWrap}`}
                >
                  <Icon size={16} />
                </div>
              </div>
              
              <div>
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </p>
                <p
                  className={`${isAmount ? "text-[30px]" : "text-3xl"} font-bold leading-none tabular-nums ${theme.value}`}
                >
                  {loading ? (
                    <span className="inline-block h-6 w-10 animate-pulse rounded bg-slate-200" />
                  ) : (
                    displayValue
                  )}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">Click to view</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}