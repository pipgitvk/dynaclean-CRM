import ImportAgentQuoteFormClient from "./ImportAgentQuoteFormClient";

export const dynamic = "force-dynamic";

export default async function ImportAgentQuotePage({ params }) {
  const { token } = await params;
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <ImportAgentQuoteFormClient token={String(token ?? "")} />
    </div>
  );
}
