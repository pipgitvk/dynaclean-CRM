"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListFilter,
  Loader2,
  User,
  UserPlus,
} from "lucide-react";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
  LeadsFilterActions,
  LeadsFilterField,
  LeadsFilterFieldsGrid,
  LeadsFilterPanel,
  LeadsFilterSearch,
  LeadsFilterSelectShell,
  LeadsLastFollowupWithRemark,
  LeadsReassignFollowupOverview,
} from "@/components/Leads/LeadsManageDetailFilters";
import { REASSIGN_NO_FOLLOWUP_DAYS } from "@/lib/reassignNoFollowupConstants";

const PAGE_SIZES = [50, 100, 150];

const FOLLOWUP_STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "followed", label: "Followed" },
  { value: "not_followed", label: "Not followed" },
];

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

function repOptions(reps, emptyLabel) {
  return [
    { value: "", label: emptyLabel },
    ...reps.map((r) => ({ value: r, label: r })),
  ];
}

export default function LeadsReassignNoFollowupClient({ dashboardBase = "admin-dashboard" }) {
  const quickBulkHref = `/${dashboardBase}/leads-manage/quick-bulk-reassign`;
  const hubHref = `/${dashboardBase}/leads-manage`;

  const [searchDraft, setSearchDraft] = useState("");
  const [assignedToDraft, setAssignedToDraft] = useState("");
  const [assignedFromDraft, setAssignedFromDraft] = useState("");
  const [followupStatusDraft, setFollowupStatusDraft] = useState("not_followed");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedAssignedTo, setAppliedAssignedTo] = useState("");
  const [appliedAssignedFrom, setAppliedAssignedFrom] = useState("");
  const [appliedFollowupStatus, setAppliedFollowupStatus] = useState("not_followed");

  const [toRepList, setToRepList] = useState([]);
  const [fromRepList, setFromRepList] = useState([]);
  const [notFollowedTotal, setNotFollowedTotal] = useState(0);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);

  const filterActive = Boolean(
    appliedSearch.trim() ||
      appliedAssignedTo ||
      appliedAssignedFrom ||
      (appliedFollowupStatus && appliedFollowupStatus !== "not_followed"),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [toRes, fromRes] = await Promise.all([
          fetch("/api/reassign-no-followup?reps=1"),
          fetch("/api/bulk-lead-reassign-history?reps=1"),
        ]);
        const toData = await toRes.json();
        const fromData = await fromRes.json();
        if (!cancelled) {
          if (toData.success) setToRepList(toData.reps || []);
          if (fromData.success) setFromRepList(fromData.reps || []);
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toRepOptions = useMemo(() => repOptions(toRepList, "All assigned to"), [toRepList]);
  const fromRepOptions = useMemo(() => repOptions(fromRepList, "All assigned from"), [fromRepList]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("list", "1");
      params.set("limit", String(pageSize));
      params.set("skip", String(page * pageSize));
      if (appliedSearch.trim()) params.set("search", appliedSearch.trim());
      if (appliedAssignedTo) params.set("assigned_to", appliedAssignedTo);
      if (appliedAssignedFrom) params.set("assigned_from", appliedAssignedFrom);
      if (appliedFollowupStatus) params.set("followup_status", appliedFollowupStatus);
      const res = await fetch(`/api/reassign-no-followup?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRows(data.data || []);
        setTotal(Number(data.total || 0));
        setNotFollowedTotal(Number(data.not_followed || 0));
      } else {
        setRows([]);
        setTotal(0);
        setNotFollowedTotal(0);
      }
    } catch (e) {
      console.error(e);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, appliedAssignedTo, appliedAssignedFrom, appliedFollowupStatus, page, pageSize]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const applyFilters = () => {
    setAppliedSearch(searchDraft);
    setAppliedAssignedTo(assignedToDraft);
    setAppliedAssignedFrom(assignedFromDraft);
    setAppliedFollowupStatus(followupStatusDraft);
    setPage(0);
  };

  const clearFilters = () => {
    setSearchDraft("");
    setAssignedToDraft("");
    setAssignedFromDraft("");
    setFollowupStatusDraft("not_followed");
    setAppliedSearch("");
    setAppliedAssignedTo("");
    setAppliedAssignedFrom("");
    setAppliedFollowupStatus("not_followed");
    setPage(0);
  };

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const fromRow = total === 0 ? 0 : page * pageSize + 1;
  const toRow = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="relative min-h-screen w-full pb-10 pt-2 sm:pt-3">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-rose-50 to-transparent"
        aria-hidden
      />
      <div className="relative z-10 w-full min-w-0 px-1 sm:px-2">
        <Link
          href={quickBulkHref}
          className="mb-4 inline-flex items-center gap-2 rounded-lg px-1 text-sm font-semibold text-rose-700 hover:text-rose-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Quick Bulk Reassign
        </Link>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-xl bg-rose-50 p-2.5 text-rose-600">
              <Clock className="h-6 w-6" strokeWidth={2.2} aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Not followed after re-assign ({REASSIGN_NO_FOLLOWUP_DAYS}+ days)
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Sales leads reassigned {REASSIGN_NO_FOLLOWUP_DAYS}+ days ago with no follow-up from the new owner
                (still on assignee).
              </p>
            </div>
          </div>

          <div className="mt-5 max-w-md min-w-0">
            <LeadsReassignFollowupOverview
              notFollowed={notFollowedTotal}
              loading={loading}
              showOutside={false}
              filterActive={filterActive}
              variant="not_followed_only"
            />
          </div>

          <LeadsFilterPanel theme="rose">
            <LeadsFilterSearch
              theme="rose"
              value={searchDraft}
              onChange={setSearchDraft}
              onApply={applyFilters}
              placeholder="Customer ID, name, company, phone, assigned from/to…"
            />
            <LeadsFilterFieldsGrid columns={3}>
              <LeadsFilterField label="Follow-up status">
                <LeadsFilterSelectShell theme="rose" icon={ListFilter}>
                  <SearchableSelect
                    options={FOLLOWUP_STATUS_OPTIONS}
                    value={followupStatusDraft}
                    onChange={setFollowupStatusDraft}
                    placeholder="All"
                    searchPlaceholder="Filter…"
                    className="min-w-0 flex-1 border-0 bg-transparent shadow-none"
                  />
                </LeadsFilterSelectShell>
              </LeadsFilterField>
              <LeadsFilterField label="Assigned from">
                <LeadsFilterSelectShell theme="rose" icon={User}>
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
              <LeadsFilterField label="Assigned to (current owner)">
                <LeadsFilterSelectShell theme="rose" icon={UserPlus}>
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
            </LeadsFilterFieldsGrid>
            <LeadsFilterActions
              theme="rose"
              onApply={applyFilters}
              onClear={clearFilters}
              hubHref={hubHref}
            />
          </LeadsFilterPanel>

          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">Reassigned at</th>
                  <th className="px-4 py-3.5">Customer ID</th>
                  <th className="px-4 py-3.5">Name</th>
                  <th className="px-4 py-3.5">Company</th>
                  <th className="px-4 py-3.5">Assigned from</th>
                  <th className="px-4 py-3.5">Last follow-up assigned from</th>
                  <th className="px-4 py-3.5">Assigned to</th>
                  <th className="px-4 py-3.5">Last follow-up assign to</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Days since</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center text-slate-500">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-rose-600" aria-hidden />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-14 text-center text-slate-500">
                      No leads matching this rule right now.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-rose-50/30">
                      <td className="px-4 py-3 text-xs text-slate-600">{formatTs(row.valid_from)}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <Link
                          href={`/${dashboardBase}/view-customer/${row.customer_id}`}
                          className="font-semibold text-rose-700 hover:underline"
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
                      <td className="px-4 py-3 font-medium text-rose-800">{row.assigned_to || "—"}</td>
                      <td className="px-4 py-3">
                        <LeadsLastFollowupWithRemark
                          at={row.last_followup_assigned_to}
                          notes={row.last_followup_assigned_to_notes}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            row.followup_status === "followed"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {row.followup_status === "followed" ? "Followed" : "Not followed"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-rose-800">
                        {Number(row.days_since_reassign ?? 0)}
                      </td>
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