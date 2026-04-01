import InvoiceForm from "./submit-form";

export const dynamic = "force-dynamic";

export default async function InvoicePage() {
  const today = new Date().toISOString().split("T")[0];
  const invoiceNumber = "Auto-generated on submit";

  return (
    <div className="max-w-screen-xl mx-auto p-6 bg-white shadow-md rounded-lg">
      <InvoiceForm invoiceNumber={invoiceNumber} invoiceDate={today} />
    </div>
  );
}
