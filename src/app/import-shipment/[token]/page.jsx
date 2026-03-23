import PublicShipmentViewClient from "./PublicShipmentViewClient";

export const dynamic = "force-dynamic";

export default async function ImportShipmentPage({ params }) {
  const { token } = await params;
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <PublicShipmentViewClient token={String(token ?? "")} />
    </div>
  );
}
