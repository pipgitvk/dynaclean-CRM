import PurchaseProductsPage from "@/app/director-dashboard/purchase-products/PurchaseProductsPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Purchase Billings | DynaClean CRM" };

export default function Page() {
  return (
    <div className="w-full">
      <PurchaseProductsPage />
    </div>
  );
}
