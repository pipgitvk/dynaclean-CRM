import QuotationForm from "./submit-form";

export const dynamic = "force-dynamic";

export default async function QuotationPage() {
  const today = new Date().toISOString().split("T")[0];
  const quoteNumber = "QTN" + Date.now().toString().slice(-6); // You can fetch from DB if needed

  return (
    <div className="max-w-screen-xl mx-auto p-6 bg-white shadow-md rounded-lg">
      <QuotationForm quoteNumber={quoteNumber} quoteDate={today} />
    </div>
  );
}
