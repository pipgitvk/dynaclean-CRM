import { Loader2 } from "lucide-react";

const THEMES = {
  emerald: {
    section: "border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-white to-white",
    title: "text-emerald-800/80",
    card: "border-emerald-200/60",
    count: "text-emerald-800",
    totalShell: "border-emerald-300 bg-emerald-600",
    totalLabel: "text-emerald-100",
    spinner: "text-emerald-600",
  },
  rose: {
    section: "border-rose-200/80 bg-gradient-to-br from-rose-50/90 via-white to-white",
    title: "text-rose-800/80",
    card: "border-rose-200/60",
    count: "text-rose-800",
    totalShell: "border-rose-300 bg-rose-600",
    totalLabel: "text-rose-100",
    spinner: "text-rose-600",
  },
};

export default function LeadsReassignAssignedToBreakdownCards({
  assignedFrom,
  rows,
  loading,
  theme = "emerald",
}) {
  const t = THEMES[theme] || THEMES.emerald;
  const total = rows.reduce((sum, r) => sum + (Number(r.count) || 0), 0);

  return (
    <section className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${t.section}`}>
      <h2 className={`text-[11px] font-bold uppercase tracking-wide ${t.title}`}>
        Assigned to breakdown
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        From <span className="font-semibold text-slate-900">{assignedFrom}</span> — leads reassigned
        to each rep (same counts as the Assigned to filter).
      </p>
      {loading ? (
        <div className="mt-4 flex justify-center py-8">
          <Loader2 className={`h-7 w-7 animate-spin ${t.spinner}`} aria-hidden />
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-4 py-6 text-center text-sm text-slate-500">
          No assignments for this assigned from.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          {rows.map(({ rep, count }) => (
            <div
              key={rep}
              className={`min-w-[8.5rem] flex-1 rounded-xl border bg-white px-4 py-3 shadow-sm sm:max-w-[11rem] ${t.card}`}
            >
              <p className="truncate text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {rep}
              </p>
              <p className={`mt-1 text-2xl font-bold tabular-nums leading-none ${t.count}`}>
                {Number(count).toLocaleString()}
              </p>
            </div>
          ))}
          <div
            className={`min-w-[8.5rem] flex-1 rounded-xl border px-4 py-3 shadow-sm sm:max-w-[11rem] ${t.totalShell}`}
          >
            <p className={`text-[11px] font-bold uppercase tracking-wide ${t.totalLabel}`}>Total</p>
            <p className="mt-1 text-2xl font-bold tabular-nums leading-none text-white">
              {total.toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}