"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QuotationLineTypeModal from "@/components/Quotation/QuotationLineTypeModal";

function buildNewQuotationUrl(lineType, customerId) {
  const params = new URLSearchParams();
  if (customerId) params.set("customerId", String(customerId).trim());
  params.set("lineType", lineType);
  const qs = params.toString();
  return `/admin-dashboard/quotations/new${qs ? `?${qs}` : ""}`;
}

export default function AdminNewQuotationButton({
  customerId = "",
  className = "bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700",
  children = "New Quotation",
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleSelect = (lineType) => {
    setOpen(false);
    router.push(buildNewQuotationUrl(lineType, customerId));
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <QuotationLineTypeModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onSelect={handleSelect}
      />
    </>
  );
}

export { buildNewQuotationUrl };