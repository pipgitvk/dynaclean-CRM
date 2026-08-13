import PurchaseProductsPage from "./PurchaseProductsPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Purchase Products | DynaClean CRM" };

export default function Page() {
  return (
    <div className="w-full">
      <PurchaseProductsPage />
    </div>
  );
}
