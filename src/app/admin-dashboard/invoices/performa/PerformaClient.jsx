"use client";

import { useRouter } from "next/navigation";
import InvoiceForm from "../new/submit-form";

export default function PerformaClient({ invoiceNumber, invoiceDate }) {
  const router = useRouter();

  return (
    <InvoiceForm
      invoiceNumber={invoiceNumber}
      invoiceDate={invoiceDate}
      invoiceType="performa"
      onBack={() => router.back()}
    />
  );
}
