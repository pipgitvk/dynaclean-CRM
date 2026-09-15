import PerformaInvoiceClient from "@/components/invoice/PerformaInvoiceClient";
import PerformaInvoiceList from "@/components/invoice/PerformaInvoiceList";

export const dynamic = "force-dynamic";

export default async function PerformaInvoicePage({ searchParams }) {
  const today = new Date().toISOString().split("T")[0];
  const invoiceNumber = "Auto-generated on submit";
  const sp = await searchParams;
  const initialQuotationNumber = String(sp?.quotation_number || "").trim();

  return (
    <div className="max-w-screen-xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">New Performa Invoice</h1>
        <PerformaInvoiceClient
          invoiceNumber={invoiceNumber}
          invoiceDate={today}
          onSuccessRedirect="/service-head-dashboard/performa-invoices"
          initialQuotationNumber={initialQuotationNumber}
        />
      </div>
      <div>
        <PerformaInvoiceList viewHrefBase="/service-head-dashboard/invoices" />
      </div>
    </div>
  );
}
