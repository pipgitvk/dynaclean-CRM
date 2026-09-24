import AddPurchasePage from "./AddPurchasePage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add Purchase | DynaClean CRM" };

export default function Page() {
  return (
    <div className="w-full">
      <AddPurchasePage />
    </div>
  );
}
