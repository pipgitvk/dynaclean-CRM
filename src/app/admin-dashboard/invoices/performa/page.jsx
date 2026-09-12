import PerformaClient from "./PerformaClient";

export const dynamic = "force-dynamic";

export default function PerformaInvoicePage() {
  const today = new Date().toISOString().split("T")[0];
  const invoiceNumber = "Auto-generated on submit";

  return (
    <div className="max-w-screen-xl mx-auto p-6">
      <PerformaClient invoiceNumber={invoiceNumber} invoiceDate={today} />
    </div>
  );
}
