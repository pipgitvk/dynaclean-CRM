"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  User,
  UserCog,
  UserPlus,
} from "lucide-react";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
  LeadsFilterActions,
  LeadsFilterField,
  LeadsFilterFieldsGrid,
  LeadsFilterPanel,
  LeadsFilterSearch,
  LeadsFilterSelectShell,
  LeadsDetailTotalStat,
  LeadsLastFollowupWithRemark,
  dateInputClass,
  dateInputWrapperClass,
} from "@/components/Leads/LeadsManageDetailFilters";

function formatTs(value) {
  if (!value) return "—";
  const s = String(value);
  if (s.startsWith("0000-00-00")) return "—";
  try {
    return format(new Date(s), "dd MMM yyyy, HH:mm");
  } catch {
    return s;
  }
}

const PAGE_SIZES = [50, 100, 150];

function repOptions(reps, emptyLabel) {
  return [
    { value: "", label: emptyLabel },
    ...reps.map((r) => ({ value: r, label: r })),
  ];
}

function repOptionsWithCounts(countRows, emptyLabel) {
  return [
    { value: "", label: emptyLabel },
    ...countRows.map(({ rep, count }) => ({
      value: rep,
      label: `${rep} (${count.toLocaleString()})`,
    })),
  ];
}

export default function LeadsReassignHistoryClient({ dashboardBase = "admin-dashboard" }) {
  const quickBulkHref = `/${dashboardBase}/leads-manage/quick-bulk-reassign`;
  const hubHref = `/${dashboardBase}/leads-manage`;

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [assignedFromDraft, setAssignedFromDraft] = useState("");
  const [assignedToDraft, setAssignedToDraft] = useState("");
  const [assignedByDraft, setAssignedByDraft] = useState("");

  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedAssignedFrom, setAppliedAssignedFrom] = useState("");
  const [appliedAssignedTo, setAppliedAssignedTo] = useState("");
  const [appliedAssignedBy, setAppliedAssignedBy] = useState("");

  const [repList, setRepList] = useState([]);
  const [assignedByRepList, setAssignedByRepList] = useState([]);
  const [fromRepCounts, setFromRepCounts] = useState([]);
  const [toRepCounts, setToRepCounts] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [repsRes, byRes] = await Promise.all([
          fetch("/api/bulk-lead-reassign-history?reps=1"),
          fetch("/api/bulk-lead-reassign-history?assigned_by_reps=1"),
        ]);
        const repsData = await repsRes.json();
        const byData = await byRes.json();
        if (!cancelled) {
          if (repsData.success) setRepList(repsData.reps || []);
          if (byData.success) setAssignedByRepList(byData.assignedByReps || []);
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!appliedAssignedTo) {
        setFromRepCounts([]);
        return;
      }
      try {
        const params = new URLSearchParams();
        params.set("from_counts", "1");
        params.set("assigned_to", appliedAssignedTo);
        if (appliedFrom) params.set("from", appliedFrom);
        if (appliedTo) params.set("to", appliedTo);
        if (appliedSearch.trim()) params.set("search", appliedSearch.trim());
        if (appliedAssignedBy) params.set("assigned_by", appliedAssignedBy);
        const res = await fetch(`/api/bulk-lead-reassign-history?${params.toString()}`);
        const data = await res.json();
        if (!cancelled && data.success) setFromRepCounts(data.fromCounts || []);
      } catch (e) {
        console.error(e);
        if (!cancelled) setFromRepCounts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appliedAssignedTo, appliedFrom, appliedTo, appliedSearch, appliedAssignedBy]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!appliedAssignedFrom) {
        setToRepCounts([]);
        return;
      }
      try {
        const params = new URLSearchParams();
        params.set("to_counts", "1");
        params.set("assigned_from", appliedAssignedFrom);
        if (appliedFrom) params.set("from", appliedFrom);
        if (appliedTo) params.set("to", appliedTo);
        if (appliedSearch.trim()) params.set("search", appliedSearch.trim());
        if (appliedAssignedBy) params.set("assigned_by", appliedAssignedBy);
        const res = await fetch(`/api/bulk-lead-reassign-history?${params.toString()}`);
        const data = await res.json();
        if (!cancelled && data.success) setToRepCounts(data.toCounts || []);
      } catch (e) {
        console.error(e);
        if (!cancelled) setToRepCounts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appliedAssignedFrom, appliedFrom, appliedTo, appliedSearch, appliedAssignedBy]);

  const assignedByOptions = useMemo(
    () => repOptions(assignedByRepList, "All assigned by"),
    [assignedByRepList],
  );

  const fromRepOptions = useMemo(() => {
    if (appliedAssignedTo && fromRepCounts.length > 0) {
      return repOptionsWithCounts(fromRepCounts, "All assigned from");
    }
    return repOptions(repList, "All assigned from");
  }, [appliedAssignedTo, fromRepCounts, repList]);

  const toRepOptions = useMemo(() => {
    if (appliedAssignedFrom && toRepCounts.length > 0) {
      return repOptionsWithCounts(toRepCounts, "All assigned to");
    }
    return repOptions(repList, "All assigned to");
  }, [appliedAssignedFrom, toRepCounts, repList]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("events", "1");
      params.set("limit", String(pageSize));
      params.set("skip", String(page * pageSize));
      if (appliedFrom) params.set("from", appliedFrom);
      if (appliedTo) params.set("to", appliedTo);
      if (appliedSearch.trim()) params.set("search", appliedSearch.trim());
      if (appliedAssignedFrom) params.set("assigned_from", appliedAssignedFrom);
      if (appliedAssignedTo) params.set("assigned_to", appliedAssignedTo);
      if (appliedAssignedBy) params.set("assigned_by", appliedAssignedBy);
      const res = await fetch(`/api/bulk-lead-reassign-history?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRows(data.data || []);
        setTotal(Number(data.total || 0));
      } else {
        setRows([]);
        setTotal(0);
      }
    } catch (e) {
      console.error(e);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    appliedFrom,
    appliedTo,
    appliedSearch,
    appliedAssignedFrom,
    appliedAssignedTo,
    appliedAssignedBy,
    page,
    pageSize,
  ]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const applyFilters = () => {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
    setAppliedSearch(searchDraft);
    setAppliedAssignedFrom(assignedFromDraft);
    setAppliedAssignedTo(assignedToDraft);
    setAppliedAssignedBy(assignedByDraft);
    setPage(0);
  };

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
    setSearchDraft("");
    setAssignedFromDraft("");
    setAssignedToDraft("");
    setAssignedByDraft("");
    setAppliedFrom("");
    setAppliedTo("");
    setAppliedSearch("");
    setAppliedAssignedFrom("");
    setAppliedAssignedTo("");
    setAppliedAssignedBy("");
    setPage(0);
  };

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const fromRow = total === 0 ? 0 : page * pageSize + 1;
  const toRow = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="relative min-h-screen w-full pb-10 pt-2 sm:pt-3">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-emerald-50 to-transparent"
        aria-hidden
      />
      <div className="relative z-10 w-full min-w-0 px-1 sm:px-2">
        <Link
          href={quickBulkHref}
          className="mb-4 inline-flex items-center gap-2 rounded-lg px-1 text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Quick Bulk Reassign
        </Link>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                <History className="h-6 w-6" strokeWidth={2.2} aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lead reassignment history</h1>
                <p className="mt-1 text-sm text-slate-500">
                  All bulk reassign events with last follow-up by previous and new owner.
                </p>
              </div>
            </div>
            <LeadsDetailTotalStat theme="emerald" label="Total re-assign" total={total} loading={loading} />
          </div>

          <LeadsFilterPanel theme="emerald">
            <LeadsFilterSearch
              theme="emerald"
              value={searchDraft}
              onChange={setSearchDraft}
              onApply={applyFilters}
              placeholder="Customer ID, name, company, phone, assigned from/to, assigned by…"
            />
            <LeadsFilterFieldsGrid columns={5}>
              <LeadsFilterField label="From date" icon={CalendarDays}>
                <TypeableDateFilterInput
                  value={fromDate}
                  onChange={setFromDate}
                  wrapperClassName={dateInputWrapperClass}
                  className={dateInputClass}
                />
              </LeadsFilterField>
              <LeadsFilterField label="To date" icon={CalendarDays}>
                <TypeableDateFilterInput
                  value={toDate}
                  onChange={setToDate}
                  wrapperClassName={dateInputWrapperClass}
                  className={dateInputClass}
                />
              </LeadsFilterField>
              <LeadsFilterField label="Assigned from">
                <LeadsFilterSelectShell theme="emerald" icon={User}>
                  <SearchableSelect
                    options={fromRepOptions}
                    value={assignedFromDraft}
                    onChange={setAssignedFromDraft}
                    placeholder="All assigned from"
                    searchPlaceholder="Search rep…"
                    className="min-w-0 flex-1 border-0 bg-transparent shadow-none"
                  />
                </LeadsFilterSelectShell>
              </LeadsFilterField>
              <LeadsFilterField label="Assigned to">
                <LeadsFilterSelectShell theme="emerald" icon={UserPlus}>
                  <SearchableSelect
                    options={toRepOptions}
                    value={assignedToDraft}
                    onChange={setAssignedToDraft}
                    placeholder="All assigned to"
                    searchPlaceholder="Search rep…"
                    className="min-w-0 flex-1 border-0 bg-transparent shadow-none"
                  />
                </LeadsFilterSelectShell>
              </LeadsFilterField>
              <LeadsFilterField label="Assigned by">
                <LeadsFilterSelectShell theme="emerald" icon={UserCog}>
                  <SearchableSelect
                    options={assignedByOptions}
                    value={assignedByDraft}
                    onChange={setAssignedByDraft}
                    placeholder="All assigned by"
                    searchPlaceholder="Search user…"
                    className="min-w-0 flex-1 border-0 bg-transparent shadow-none"
                  />
                </LeadsFilterSelectShell>
              </LeadsFilterField>
            </LeadsFilterFieldsGrid>
            <LeadsFilterActions
              theme="emerald"
              onApply={applyFilters}
              onClear={clearFilters}
              hubHref={hubHref}
            />
          </LeadsFilterPanel>

          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">Customer ID</th>
                  <th className="px-4 py-3.5">Name</th>
                  <th className="px-4 py-3.5">Company</th>
                  <th className="px-4 py-3.5">Assigned from</th>
                  <th className="px-4 py-3.5">Last follow-up assigned from</th>
                  <th className="px-4 py-3.5">Assigned to</th>
                  <th className="px-4 py-3.5">Last follow-up assign to</th>
                  <th className="px-4 py-3.5">Reassigned at</th>
                  <th className="px-4 py-3.5">Assigned by</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center text-slate-500">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-600" aria-hidden />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center text-slate-500">
                      No reassignment records for this filter.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-emerald-50/30">
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        <Link
                          href={`/${dashboardBase}/view-customer/${row.customer_id}`}
                          className="font-semibold text-emerald-700 hover:underline"
                        >
                          {row.customer_id}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-800">{row.name || "—"}</td>
                      <td className="max-w-[160px] truncate px-4 py-3 text-slate-700" title={row.company_name || ""}>
                        {row.company_name || "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{row.assigned_from || "—"}</td>
                      <td className="px-4 py-3">
                        <LeadsLastFollowupWithRemark
                          at={row.last_followup_assigned_from}
                          notes={row.last_followup_assigned_from_notes}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-emerald-800">{row.assigned_to || "—"}</td>
                      <td className="px-4 py-3">
                        <LeadsLastFollowupWithRemark
                          at={row.last_followup_assigned_to}
                          notes={row.last_followup_assigned_to_notes}
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{formatTs(row.valid_from)}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{row.assigned_by || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <span>
              Showing {fromRow} – {toRow} of {total}
            </span>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
                className="rounded-lg border border-slate-200 px-2 py-1"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[4rem] text-center">
                {page + 1} / {pageCount}
              </span>
              <button
                type="button"
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}