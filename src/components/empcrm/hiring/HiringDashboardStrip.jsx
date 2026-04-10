"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import HiringEntryCard from "./HiringEntryCard";

const HIRING_PAGE = "/empcrm/admin-dashboard/hiring";

/** Dashboard strip: only these pipeline rows (not Hired / Reject / Waiting List, etc.) */
const DASHBOARD_PIPELINE_STATUSES = new Set([
  "Rescheduled",
  "next-follow-up",
  "Shortlisted for interview",
]);

function LegendItem({ dotClass, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 sm:text-sm">
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full shadow-sm ring-2 ring-white ${dotClass}`}
        aria-hidden
      />
      {label}
    </span>
  );
}

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

  const pipelineEntries = useMemo(() => {
    return entries.filter((row) => DASHBOARD_PIPELINE_STATUSES.has(String(row.status || "").trim()));
  }, [entries]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-50/95 via-white to-indigo-50/50 p-1 shadow-[0_24px_60px_-20px_rgba(79,70,229,0.18)] sm:p-1.5">
      <div className="rounded-[1.35rem] bg-white/90 p-4 shadow-inner shadow-slate-200/40 backdrop-blur-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/35 ring-4 ring-indigo-100/80">
              <Users className="h-6 w-6" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-xl font-bold tracking-tight text-transparent sm:text-2xl">
                Candidates
              </h2>
             
              <div
                className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-2 border-slate-200 pl-3"
                role="list"
                aria-label="Card colour code"
              >
                <LegendItem
                  dotClass="bg-gradient-to-br from-rose-700 via-rose-500 to-orange-300"
                  label="Soon"
                />
                <LegendItem
                  dotClass="bg-gradient-to-br from-amber-600 to-amber-300"
                  label="Medium"
                />
                <LegendItem
                  dotClass="bg-gradient-to-br from-teal-700 via-emerald-500 to-teal-200"
                  label="Later"
                />
              </div>
            </div>
          </div>
          <Link
            href={HIRING_PAGE}
            className="group inline-flex shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-500/40"
          >
            Open hiring
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
        </div>

        {loading ? (
          <div className="flex gap-5 overflow-x-auto pb-3 pt-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[22rem] min-w-[288px] shrink-0 animate-pulse rounded-3xl bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/40 ring-1 ring-slate-200/60"
              />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200/90 bg-gradient-to-b from-slate-50/80 to-white px-6 py-14 text-center">
            <p className="text-base font-semibold text-slate-800">No hiring records for {year}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Start building your pipeline from the Hiring workspace.
            </p>
            <Link
              href={HIRING_PAGE}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800"
            >
              Go to Hiring
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : pipelineEntries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-amber-200/80 bg-amber-50/40 px-6 py-10 text-center">
            <p className="text-sm font-semibold text-slate-800">No rescheduled, next follow-up, or follow-up candidates</p>
            <p className="mx-auto mt-2 max-w-md text-xs text-slate-600 sm:text-sm">
              Other statuses (e.g. Hired, Waiting list) stay on the Hiring page.
            </p>
            <Link
              href={HIRING_PAGE}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Open hiring
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="w-full overflow-x-auto pb-2 pt-1 hide-scrollbar [mask-image:linear-gradient(to_right,black_96%,transparent)] sm:[mask-image:none]">
            <div className="flex min-w-max flex-row flex-nowrap gap-5 px-0.5">
              {pipelineEntries.map((row) => (
                <HiringEntryCard key={row.id} row={row} showEditButton={false} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
