import Link from "next/link";
import SuppliersListClient from "./SuppliersListClient";

export default function ImportCrmSuppliersPage() {
  return (
    <div className="mx-auto w-full max-w-screen-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:p-8 dark:border-slate-200 dark:bg-white">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Suppliers
        </h1>
        <Link
          href="/admin-dashboard/import-crm/purchase-orders"
          className="text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
        >
          Purchase orders →
        </Link>
      </div>

      <SuppliersListClient />
    </div>
  );
}
