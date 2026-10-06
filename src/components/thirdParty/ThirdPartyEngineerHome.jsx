import Link from "next/link";
import { ClipboardList, CheckCircle2, Clock } from "lucide-react";

const cardClass =
  "rounded-xl border border-slate-100 bg-white p-5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08),0_2px_4px_-2px_rgba(0,0,0,0.05)]";

export default function ThirdPartyEngineerHome({ engineer, counts }) {
  const name = engineer?.name || "Engineer";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {name}</h1>
        <p className="text-slate-600 mt-1">Third party service engineer dashboard</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cardClass}>
          <div className="flex items-center gap-3">
            <ClipboardList className="text-blue-600" size={28} />
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Assigned</p>
              <p className="text-2xl font-bold text-slate-900">{counts.total}</p>
            </div>
          </div>
        </div>
        <div className={cardClass}>
          <div className="flex items-center gap-3">
            <Clock className="text-amber-600" size={28} />
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Pending</p>
              <p className="text-2xl font-bold text-slate-900">{counts.pending}</p>
            </div>
          </div>
        </div>
        <div className={cardClass}>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-green-600" size={28} />
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Completed</p>
              <p className="text-2xl font-bold text-slate-900">{counts.completed}</p>
            </div>
          </div>
        </div>
      </div>

      <Link
        href="/third-party-engineer-dashboard/services"
        className={`${cardClass} block hover:border-blue-200 transition`}
      >
        <h2 className="text-lg font-semibold text-slate-900">Service History</h2>
        <p className="text-sm text-slate-600 mt-1">
          View and update jobs assigned to you — same workflow as internal service engineers.
        </p>
      </Link>
    </div>
  );
}
