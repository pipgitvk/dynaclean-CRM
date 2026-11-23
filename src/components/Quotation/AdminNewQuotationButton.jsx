"use client";

import { useRouter } from "next/navigation";

function buildNewQuotationUrl(customerId) {
  const params = new URLSearchParams();
  if (customerId) params.set("customerId", String(customerId).trim());
  const qs = params.toString();
  return `/admin-dashboard/quotations/new${qs ? `?${qs}` : ""}`;
}

export default function AdminNewQuotationButton({
  customerId = "",
  className = "bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700",
  children = "New Quotation",
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(buildNewQuotationUrl(customerId))}
      className={className}
    >
      {children}
    </button>
  );
}

export { buildNewQuotationUrl };