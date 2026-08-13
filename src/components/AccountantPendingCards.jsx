"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Wallet, Clock, ClipboardList, Receipt } from "lucide-react";

const CARDS = [
  {
    key: "invoicePending",
    label: "Invoice Pending",
    icon: FileText,
    color: "red",
    href: "/accounts-dashboard/order?status=pendinginvoice&fromCard=1",
  },
  {
    key: "unsettledPayment",
    label: "Unsettled Payment",
    icon: Wallet,
    color: "orange",
    href: "/admin-dashboard/statements?status=Unsettled&fromCard=1",
  },
  {
    key: "paymentPending",
    label: "Payment Pending",
    icon: Clock,
    color: "yellow",
    href: "/accounts-dashboard/reports/payment-pending?fromCard=1",
  },
  {
    key: "taskPending",
    label: "Task Pending",
    icon: ClipboardList,
    color: "purple",
    href: "/accounts-dashboard/task-manager?status=Pending&fromCard=1",
  },
  {
    key: "expensePaymentPending",
    label: "Expense Payment Pending",
    icon: Receipt,
    color: "blue",
    href: "/accounts-dashboard/all-expenses?status=Approved&linking=unlinked&fromCard=1",
  },
  {
    key: "expenseApprovePending",
    label: "Expense Approve Pending",
    icon: Receipt,
    color: "purple",
    href: "/accounts-dashboard/all-expenses?status=Pending&fromCard=1",
  },
];

const COLOR_MAP = {
  red:    { bg: "bg-red-50",    border: "border-red-400",    text: "text-red-600",    icon: "bg-red-100 text-red-500" },
  orange: { bg: "bg-orange-50", border: "border-orange-400", text: "text-orange-600", icon: "bg-orange-100 text-orange-500" },
  yellow: { bg: "bg-yellow-50", border: "border-yellow-400", text: "text-yellow-600", icon: "bg-yellow-100 text-yellow-500" },
  purple: { bg: "bg-purple-50", border: "border-purple-400", text: "text-purple-600", icon: "bg-purple-100 text-purple-500" },
  blue:   { bg: "bg-blue-50",   border: "border-blue-400",   text: "text-blue-600",   icon: "bg-blue-100 text-blue-500" },
};

export default function AccountantPendingCards() {
  const router = useRouter();
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/accounts/today-report-counts")
      .then((r) => {
        console.log('API Response Status:', r.status);
        return r.json();
      })
      .then((res) => {
        console.log('API Response Data:', res);
        if (res.success) {
          setCounts(res.data);
        } else {
          console.error('API Error:', res.error);
        }
      })
      .catch((error) => {
        console.error('Fetch Error:', error);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-800">Summary</h3>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
        {CARDS.map(({ key, label, icon: Icon, color, href }) => {
          const c = COLOR_MAP[color];
          const value = counts?.[key] ?? 0;
          
          return (
            <div
              key={key}
              onClick={() => router.push(href)}
              className={`${c.bg} border-l-4 ${c.border} rounded-xl p-2.5 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-300 group`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`${c.icon} w-8 h-8 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform`}>
                  <Icon size={16} />
                </div>
                <span className="text-lg opacity-30">
                  {key === 'invoicePending' ? '📄' : 
                   key === 'unsettledPayment' ? '💸' : 
                   key === 'paymentPending' ? '⏳' : 
                   key === 'taskPending' ? '✓' : '💰'}
                </span>
              </div>
              
              <div>
                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                  {label}
                </p>
                <p className={`text-2xl font-bold leading-none ${c.text}`}>
                  {loading ? (
                    <span className="inline-block w-6 h-6 bg-gray-200 animate-pulse rounded" />
                  ) : (
                    value
                  )}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">Click to view</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}