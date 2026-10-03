import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";
import { getDbConnection } from "@/lib/db";
import { getPendingProductRegistrationCount } from "@/lib/pendingProductRegistrationCount";

export default async function PendingProductRegistrationCard() {
  const connection = await getDbConnection();
  const count = await getPendingProductRegistrationCount(connection);

  return (
    <Link
      href="/user-dashboard/view_service_reports/upcoming-installation?registration=unregistered&type=products"
      className="group flex w-full max-w-[300px] min-h-[88px] items-center gap-3 rounded-xl border border-amber-100 bg-white p-4 shadow-sm transition hover:border-amber-200 hover:shadow-md"
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-500">
        <Package size={20} strokeWidth={2} className="text-white" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-600 leading-snug">
          Pending Product Registration
        </p>
        <p className="text-2xl font-bold leading-tight tabular-nums text-amber-600">
          {count}
        </p>
        <p className="text-xs text-slate-400">Unregistered products only</p>
      </div>

      <ArrowRight
        size={18}
        strokeWidth={2}
        className="shrink-0 text-amber-500 transition group-hover:translate-x-0.5"
      />
    </Link>
  );
}
