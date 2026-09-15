"use client";

import { useRouter } from "next/navigation";
import InvoiceForm from "@/app/admin-dashboard/invoices/new/submit-form";

export default function PerformaInvoiceClient({ invoiceNumber, invoiceDate, onSuccessRedirect, initialQuotationNumber = "" }) {
  const router = useRouter();

  return (
    <InvoiceForm
      invoiceNumber={invoiceNumber}
      invoiceDate={invoiceDate}
      invoiceType="performa"
      onBack={() => router.back()}
      onSuccessRedirect={onSuccessRedirect}
      initialQuotationNumber={initialQuotationNumber}
    />
  );
}
