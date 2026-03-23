import ImportCrmAwardFollowupsClient from "./ImportCrmAwardFollowupsClient";

export default function ImportCrmAwardFollowupsPage() {
  return (
    <div className="mx-auto w-full max-w-screen-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:p-8 dark:border-slate-200 dark:bg-white">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Award follow-ups
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          After you award a quote, the submitter fills this form — submissions
          appear here.
        </p>
      </div>

      <ImportCrmAwardFollowupsClient />
    </div>
  );
}
