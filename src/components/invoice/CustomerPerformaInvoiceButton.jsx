"use client";

import Link from "next/link";
import toast from "react-hot-toast";

export default function CustomerPerformaInvoiceButton({
  href,
  quotationNumber,
  className = "",
}) {
  const label = "Performa Invoice";

  if (quotationNumber) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        toast.error("No quotation found for this customer. Create a quotation first.")
      }
    >
      {label}
    </button>
  );
}
