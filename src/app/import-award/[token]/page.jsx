import PublicAwardFollowupClient from "./PublicAwardFollowupClient";

export const dynamic = "force-dynamic";

export default async function ImportAwardPage({ params }) {
  const { token } = await params;
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <PublicAwardFollowupClient token={String(token ?? "")} />
    </div>
  );
}
