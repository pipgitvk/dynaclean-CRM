"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Wallet, Clock, ClipboardList, Receipt } from "lucide-react";

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
];

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
        {CARDS.map(({ key, label, icon: Icon, href }) => {
          const value = counts?.[key] ?? 0;
          
          // Determine color based on value: green for 0, red for >0
          const isZero = value === 0;
          const cardBg = "bg-white";
          const cardBorder = isZero ? "border-green-400" : "border-red-400";
          const textColor = isZero ? "text-green-600" : "text-red-600";
          const iconBg = isZero ? "bg-green-100" : "bg-red-100";
          const iconColor = isZero ? "text-green-500" : "text-red-500";
          
          return (
            <div
              key={key}
              onClick={() => router.push(href)}
              className={`${cardBg} border-l-4 ${cardBorder} rounded-xl p-2.5 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-300 group shadow-sm`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`${iconBg} ${iconColor} w-8 h-8 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform`}>
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
                <p className={`text-2xl font-bold leading-none ${textColor}`}>
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