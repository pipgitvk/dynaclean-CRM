import ImportQuoteFormClient from "./ImportQuoteFormClient";

export const dynamic = "force-dynamic";

export default async function ImportQuotePage({ params }) {
  const { token } = await params;
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <ImportQuoteFormClient token={String(token ?? "")} />
    </div>
  );
}
