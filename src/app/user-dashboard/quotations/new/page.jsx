import QuotationForm from "./submit-form";
import ViewCustomerSubpageBack from "@/components/Customers/ViewCustomerSubpageBack";
import { headers } from "next/headers";
import { isDashboardEmbedPage } from "@/lib/dashboardEmbed";

export const dynamic = "force-dynamic";

export default async function QuotationPage({ searchParams }) {
  const sp = await searchParams;
  const customerId =
    sp?.customerId != null ? String(sp.customerId).trim() : "";
  const isEmbed = isDashboardEmbedPage(sp, await headers());

  const today = new Date().toISOString().split("T")[0];
  const quoteNumber = "QTN" + Date.now().toString().slice(-6); // You can fetch from DB if needed

  return (
    <div
      className={
        isEmbed
          ? "max-w-screen-xl mx-auto p-3 sm:p-4 bg-white shadow-sm rounded-lg"
          : "max-w-screen-xl mx-auto p-6 bg-white shadow-md rounded-lg"
      }
    >
      {customerId ? (
        <ViewCustomerSubpageBack
          customerId={customerId}
          dashboardBase="user-dashboard"
        />
      ) : null}
      <QuotationForm quoteNumber={quoteNumber} quoteDate={today} />
    </div>
  );
}
