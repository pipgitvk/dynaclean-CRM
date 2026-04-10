"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import HiringEntryCard from "./HiringEntryCard";

const HIRING_PAGE = "/empcrm/admin-dashboard/hiring";

export default function HiringDashboardStrip() {
  const year = new Date().getFullYear();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/empcrm/hiring?year=${year}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success && Array.isArray(json.entries)) {
        setEntries(json.entries);
      } else {
        setEntries([]);
      }
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">Candidates</h2>
          <p className="text-xs text-slate-500">
            Cards — colours follow next interview (red = soon, then yellow, green = later). Hired / Rejected
            use fixed tones.
          </p>
        </div>
        <Link
          href={HIRING_PAGE}
          className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800 transition hover:bg-indigo-100"
        >
          Open hiring
        </Link>
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 min-w-[272px] shrink-0 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">No hiring records for {year} yet.</p>
          <p className="mt-1 text-xs text-slate-500">Add candidates from the Hiring page.</p>
          <Link
            href={HIRING_PAGE}
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Go to Hiring
          </Link>
        </div>
      ) : (
        <div className="w-full overflow-x-auto py-1 hide-scrollbar">
          <div className="flex min-w-max flex-row flex-nowrap gap-4 pb-2">
            {entries.map((row) => (
              <HiringEntryCard key={row.id} row={row} showEditButton={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
