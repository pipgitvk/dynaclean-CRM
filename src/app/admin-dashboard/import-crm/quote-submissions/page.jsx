import Link from "next/link";
import ImportCrmQuoteSubmissionsClient from "./ImportCrmQuoteSubmissionsClient";

export default function ImportCrmQuoteSubmissionsPage() {
  return (
    <div className="mx-auto w-full max-w-screen-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:p-8 dark:border-slate-200 dark:bg-white">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Quote submissions
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Public shipment share link — form submissions only
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
          <Link
            href="/admin-dashboard/import-crm/suppliers"
            className="text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            Suppliers
          </Link>
          <Link
            href="/admin-dashboard/import-crm/agents"
            className="text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            Agents
          </Link>
        </div>
      </div>

      <ImportCrmQuoteSubmissionsClient />
    </div>
  );
}
