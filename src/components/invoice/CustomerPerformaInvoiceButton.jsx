"use client";

import Link from "next/link";
import toast from "react-hot-toast";

export default function CustomerPerformaInvoiceButton({
  href,
  quotationNumber,
  className = "",
  label = "Performa Invoice",
  icon: Icon = null,
}) {
  const content = (
    <>
      {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
      {label}
    </>
  );

  if (quotationNumber) {
    return (
      <Link href={href} className={className}>
        {content}
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
      {content}
    </button>
  );
}
