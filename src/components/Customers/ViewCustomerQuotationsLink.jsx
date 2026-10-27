"use client";

import Link from "next/link";
import { FileText } from "lucide-react";

/**
 * Opens quotation list filtered to this customer (admin or user dashboard).
 */
export default function ViewCustomerQuotationsLink({
  customerId,
  dashboardBase,
  className = "",
  variant = "admin",
}) {
  const href = `/${dashboardBase}/quotations?customer_id=${encodeURIComponent(String(customerId))}`;

  const base =
    variant === "user"
      ? "btn text-white bg-slate-700 hover:bg-slate-800 py-2 px-4 rounded-md w-full md:w-auto text-center transition duration-300 inline-flex items-center justify-center gap-2"
      : "btn w-full md:w-auto md:flex-shrink-0 whitespace-nowrap text-white bg-slate-700 hover:bg-slate-800 py-2 px-4 rounded-md text-center transition duration-300 inline-flex items-center justify-center gap-2";

  return (
    <Link href={href} className={`${base} ${className}`.trim()}>
      <FileText className="w-4 h-4 shrink-0" aria-hidden />
      <span>View All Quotations</span>
    </Link>
  );
}
