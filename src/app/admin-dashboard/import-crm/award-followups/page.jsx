import Link from "next/link";
import ImportCrmAwardFollowupsClient from "./ImportCrmAwardFollowupsClient";

export default function ImportCrmAwardFollowupsPage() {
  return (
    <div className="mx-auto w-full max-w-screen-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:p-8 dark:border-slate-200 dark:bg-white">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Award follow-ups
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            After you award a quote, the submitter fills this form — submissions
            appear here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
          <Link
            href="/admin-dashboard/import-crm/quote-submissions"
            className="text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            Quote submissions
          </Link>
          <Link
            href="/admin-dashboard/import-crm/shipments"
            className="text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            Shipments
          </Link>
        </div>
      </div>

      <ImportCrmAwardFollowupsClient />
    </div>
  );
}
