import BuyerCards from "./BuyerCards";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoices | DynaClean CRM" };

export default function InvoicePage() {
  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-6 w-full">
      <BuyerCards />
    </div>
  );
}
