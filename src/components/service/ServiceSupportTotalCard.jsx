"use client";

import { FileText } from "lucide-react";

const formatCurrency = (amount) => {
  const val = parseFloat(amount);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(val) ? val : 0);
};

export default function ServiceSupportTotalCard({
  totalAmount = 0,
  quotationCount = 0,
  quotationAmount = 0,
  orderProcessCount = 0,
  orderProcessAmount = 0,
}) {
  return (
    <div className="bg-white rounded-lg shadow-md p-3 text-black h-full border-l-4 border-amber-500 min-h-[140px] flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-5 h-5 text-amber-500 shrink-0" />
        <h2 className="text-sm font-bold text-black leading-tight">
          SS Total
        </h2>
      </div>

      <p className="text-xl font-bold text-gray-900 tabular-nums">
        {formatCurrency(totalAmount)}
      </p>
      <p className="text-[10px] text-gray-500 mb-2">Quotations + Order Process</p>

      <div className="flex flex-wrap gap-1.5 mt-auto">
        <a
          href="/admin-dashboard/quotations?ss=1"
          className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-gray-700 hover:border-amber-300 hover:bg-amber-100"
        >
          QT{" "}
          <span className="font-bold text-amber-800 mx-0.5">{quotationCount}</span>
          <span className="text-gray-400">|</span>
          <span className="font-semibold text-amber-800 ml-0.5">
            {formatCurrency(quotationAmount)}
          </span>
        </a>
        <a
          href="/admin-dashboard/order?ss=1"
          className="inline-flex items-center rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] text-gray-700 hover:border-teal-300 hover:bg-teal-100"
        >
          OP{" "}
          <span className="font-bold text-teal-800 mx-0.5">{orderProcessCount}</span>
          <span className="text-gray-400">|</span>
          <span className="font-semibold text-teal-800 ml-0.5">
            {formatCurrency(orderProcessAmount)}
          </span>
        </a>
      </div>
    </div>
  );
}
