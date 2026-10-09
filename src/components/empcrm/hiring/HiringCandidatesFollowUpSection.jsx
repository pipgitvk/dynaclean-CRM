"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import HiringEntryCard from "./HiringEntryCard";
import { TL_FOLLOWUP_LEGEND } from "@/utils/hiringFollowUpUrgency";

function isCandidatesFollowUpRow(row) {
  return true;
}

const HIRING_ROUTE = "/empcrm/admin-dashboard/hiring";

function scheduleSortKey(row) {
  if (row.next_followup_at) {
    const ms = new Date(row.next_followup_at).getTime();
    return Number.isFinite(ms) ? ms : Infinity;
  }
  return Infinity;
}

function buildFollowUpList(entries) {
  const list = entries.filter((row) => isCandidatesFollowUpRow(row));
  return [...list].sort((a, b) => scheduleSortKey(a) - scheduleSortKey(b));
}

/**
 * Pipeline cards: Rescheduled, next-follow-up, legacy status follow-up, Waiting List, and Hired with tag Follow-Up.
 * - Uncontrolled: fetches `/api/empcrm/hiring?year=` (default: current calendar year).
 * - Controlled: pass `entries` + `loading` from parent.
 * @param {{ entries?: Array, loading?: boolean, year?: number, showOpenHiringLink?: boolean }} props
 */
export default function HiringCandidatesFollowUpSection({
  entries: entriesProp,
  loading: loadingProp,
  year: yearProp,
  showOpenHiringLink = false,
}) {
  const router = useRouter();
  const year = yearProp ?? new Date().getFullYear();
  const controlled = entriesProp !== undefined;

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(!controlled);

  const load = useCallback(async () => {
    if (controlled) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/empcrm/hiring?year=${year}`, { cache: "no-store" });
      const json = await res.json();
      setEntries(json.success ? json.entries || [] : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [controlled, year]);

  useEffect(() => {
    if (!controlled) load();
  }, [controlled, load]);

  const rawEntries = controlled ? entriesProp : entries;
  const rawLoading = controlled ? loadingProp : loading;

  const followUpCandidates = useMemo(() => buildFollowUpList(rawEntries || []), [rawEntries]);

  if (controlled && rawLoading) {
    return null;
  }

  if (!controlled && rawLoading) {
    return (
      <section className="min-w-0" aria-labelledby="candidates-followup-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2
            id="candidates-followup-heading"
            className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg"
          >
            Candidates follow-up
          </h2>
        </div>
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-slate-50/60 px-4 py-10 text-sm text-slate-500">
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"
            aria-hidden
          />
          Loading…
        </div>
      </section>
    );
  }

  return (
    <section className="min-w-0" aria-labelledby="candidates-followup-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2
          id="candidates-followup-heading"
          className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg"
        >
          Candidates follow-up
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {followUpCandidates.length > 0 ? (
            <span className="text-xs font-medium text-slate-500">{followUpCandidates.length} in pipeline</span>
          ) : null}
          {showOpenHiringLink ? (
            <Link
              href={HIRING_ROUTE}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 sm:text-sm"
            >
              Open hiring
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>

      <div
        className="mb-4 flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-slate-200/80 bg-slate-50/90 px-3 py-2.5 sm:px-4"
        role="list"
        aria-label="Card colours by how soon the next date is"
      >
        <span className="w-full text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-[11px]">
          Card colours (by next relevant date)
        </span>
        {TL_FOLLOWUP_LEGEND.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-2 text-[11px] text-slate-700 sm:text-xs" role="listitem">
            <span
              className={`h-2.5 w-9 shrink-0 rounded-full shadow-sm ring-1 ring-black/5 ${item.dotClass}`}
              aria-hidden
            />
            <span className="font-semibold text-slate-800">{item.label}</span>
          </span>
        ))}
      </div>

      {followUpCandidates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/60 px-4 py-8 text-center">
          <p className="text-sm text-slate-600">
            No candidates found for this year.
          </p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto pb-2 pt-0.5 [scrollbar-gutter:stable]">
          <div className="flex min-w-0 flex-row flex-nowrap gap-4 sm:gap-5">
            {followUpCandidates.map((row) => (
              <HiringEntryCard
                key={row.id}
                row={row}
                showEditButton={false}
                showViewButton={true}
                onView={() => router.push(`${HIRING_ROUTE}/${row.id}/view`)}
                colorScheme="tl-followup"
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
