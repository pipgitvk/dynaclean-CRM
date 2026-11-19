"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Layers,
  ListChecks,
  ListTodo,
  Loader2,
  Mail,
  Megaphone,
  Phone,
  User,
} from "lucide-react";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { CUSTOMER_STAGE_FILTER_OPTIONS } from "@/constants/customerStageOptions";
import {
  LeadsFilterActions,
  LeadsFilterField,
  LeadsFilterPanel,
  LeadsFilterFieldsGrid,
  LeadsFilterSearch,
  LeadsFilterSelectShell,
  LeadsDetailTotalStat,
  LeadsLastFollowupWithRemark,
} from "@/components/Leads/LeadsManageDetailFilters";

const PAGE_SIZES = [50, 100, 150];

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "New", label: "New" },
  { value: "verygud", label: "Very Good" },
  { value: "average", label: "Average" },
  { value: "poor", label: "Poor" },
  { value: "denied", label: "Denied" },
  { value: "invalid", label: "Invalid" },
  { value: "old_reassign", label: "Old Reassign" },
];

const CAMPAIGN_FILTER_OPTIONS = [
  { value: "", label: "All Lead Campaigns" },
  { value: "india_mart", label: "India Mart" },
  { value: "social_media", label: "Social Media" },
  { value: "google_ads", label: "Google Ads" },
  { value: "website_visit", label: "Website Visit" },
  { value: "direct_call", label: "Direct Call" },
  { value: "manager_assigned", label: "Manager Assign" },
];

function customerName(row) {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return name || "—";
}

function formatStatusLabel(status) {
  const s = String(status || "").trim();
  if (!s) return "—";
  const lower = s.toLowerCase();
  if (lower === "verygud") return "Very Good";
  if (lower === "old_reassign") return "Old Reassign";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusBadgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("denied")) return "bg-rose-100 text-rose-800";
  if (s.includes("invalid")) return "bg-amber-100 text-amber-900";
  if (s === "new") return "bg-emerald-100 text-emerald-800";
  return "bg-slate-100 text-slate-700";
}

function formatCampaign(raw) {
  const s = String(raw || "").trim();
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateCreated(value) {
  if (!value) return "—";
  const s = String(value);
  if (s.startsWith("0000-00-00")) return "—";
  try {
    return format(new Date(s), "dd MMM yyyy");
  } catch {
    return s;
  }
}

function repOptions(reps, emptyLabel) {
  return [
    { value: "", label: emptyLabel },
    ...reps.map((r) => ({ value: r, label: `${r} (Inactive)` })),
  ];
}

export default function LeadsPendingReassignClient({ dashboardBase = "admin-dashboard" }) {
  const quickBulkHref = `/${dashboardBase}/leads-manage/quick-bulk-reassign`;
  const hubHref = `/${dashboardBase}/leads-manage`;

  const [searchDraft, setSearchDraft] = useState("");
  const [repDraft, setRepDraft] = useState("");
  const [stageDraft, setStageDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [campaignDraft, setCampaignDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedRep, setAppliedRep] = useState("");
  const [appliedStage, setAppliedStage] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [appliedCampaign, setAppliedCampaign] = useState("");

  const [repList, setRepList] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/pending-lead-reassign?reps=1");
        const data = await res.json();
        if (!cancelled && data.success) setRepList(data.reps || []);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const repFilterOptions = useMemo(() => repOptions(repList, "All inactive reps"), [repList]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("list", "1");
      params.set("limit", String(pageSize));
      params.set("skip", String(page * pageSize));
      if (appliedSearch.trim()) params.set("search", appliedSearch.trim());
      if (appliedRep) params.set("lead_source", appliedRep);
      if (appliedStage) params.set("stage", appliedStage);
      if (appliedStatus) params.set("status", appliedStatus);
      if (appliedCampaign) params.set("lead_campaign", appliedCampaign);
      const res = await fetch(`/api/pending-lead-reassign?${params.toString()}`);
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
  }, [appliedSearch, appliedRep, appliedStage, appliedStatus, appliedCampaign, page, pageSize]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const applyFilters = () => {
    setAppliedSearch(searchDraft);
    setAppliedRep(repDraft);
    setAppliedStage(stageDraft);
    setAppliedStatus(statusDraft);
    setAppliedCampaign(campaignDraft);
    setPage(0);
  };

  const clearFilters = () => {
    setSearchDraft("");
    setRepDraft("");
    setStageDraft("");
    setStatusDraft("");
    setCampaignDraft("");
    setAppliedSearch("");
    setAppliedRep("");
    setAppliedStage("");
    setAppliedStatus("");
    setAppliedCampaign("");
    setPage(0);
  };

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const fromRow = total === 0 ? 0 : page * pageSize + 1;
  const toRow = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="relative min-h-screen w-full pb-10 pt-2 sm:pt-3">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-amber-50 to-transparent"
        aria-hidden
      />
      <div className="relative z-10 w-full min-w-0 px-1 sm:px-2">
        <Link
          href={quickBulkHref}
          className="mb-4 inline-flex items-center gap-2 rounded-lg px-1 text-sm font-semibold text-amber-800 hover:text-amber-950"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Quick Bulk Reassign
        </Link>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
                <ListTodo className="h-6 w-6" strokeWidth={2.2} aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leads pending re-assign</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Sales leads still assigned to inactive salespersons — ready for bulk reassignment.
                </p>
              </div>
            </div>
            <LeadsDetailTotalStat theme="amber" label="Total pending" total={total} loading={loading} />
          </div>

          <LeadsFilterPanel theme="amber">
            <LeadsFilterSearch
              theme="amber"
              value={searchDraft}
              onChange={setSearchDraft}
              onApply={applyFilters}
              placeholder="Customer ID, name, company, phone, lead source…"
            />
            <LeadsFilterFieldsGrid columns={5}>
              <LeadsFilterField label="Inactive lead source">
                <LeadsFilterSelectShell theme="amber" icon={User}>
                  <SearchableSelect
                    options={repFilterOptions}
                    value={repDraft}
                    onChange={setRepDraft}
                    placeholder="All inactive reps"
                    searchPlaceholder="Search rep…"
                    className="!border-0 w-full min-w-0 bg-transparent px-2 py-2 shadow-none"
                  />
                </LeadsFilterSelectShell>
              </LeadsFilterField>
              <LeadsFilterField label="Stage">
                <LeadsFilterSelectShell theme="amber" icon={Layers}>
                  <SearchableSelect
                    options={CUSTOMER_STAGE_FILTER_OPTIONS}
                    value={stageDraft}
                    onChange={setStageDraft}
                    placeholder="All Stage"
                    searchPlaceholder="Search stage…"
                    className="!border-0 w-full min-w-0 bg-transparent px-2 py-2 shadow-none"
                  />
                </LeadsFilterSelectShell>
              </LeadsFilterField>
              <LeadsFilterField label="Status">
                <LeadsFilterSelectShell theme="amber" icon={ListChecks}>
                  <SearchableSelect
                    options={STATUS_FILTER_OPTIONS}
                    value={statusDraft}
                    onChange={setStatusDraft}
                    placeholder="All Status"
                    searchPlaceholder="Search status…"
                    className="!border-0 w-full min-w-0 bg-transparent px-2 py-2 shadow-none"
                  />
                </LeadsFilterSelectShell>
              </LeadsFilterField>
              <LeadsFilterField label="Lead campaign">
                <LeadsFilterSelectShell theme="amber" icon={Megaphone}>
                  <SearchableSelect
                    options={CAMPAIGN_FILTER_OPTIONS}
                    value={campaignDraft}
                    onChange={setCampaignDraft}
                    placeholder="All Lead Campaigns"
                    searchPlaceholder="Search campaign…"
                    className="!border-0 w-full min-w-0 bg-transparent px-2 py-2 shadow-none"
                  />
                </LeadsFilterSelectShell>
              </LeadsFilterField>
            </LeadsFilterFieldsGrid>
            <LeadsFilterActions
              theme="amber"
              onApply={applyFilters}
              onClear={clearFilters}
              hubHref={hubHref}
            />
          </LeadsFilterPanel>

          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">Customer</th>
                  <th className="px-4 py-3.5">Lead source (inactive)</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Lead campaign</th>
                  <th className="px-4 py-3.5">Stage</th>
                  <th className="px-4 py-3.5">Last follow-up</th>
                  <th className="px-4 py-3.5">Company</th>
                  <th className="px-4 py-3.5">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-slate-500">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-600" aria-hidden />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center text-slate-500">
                      No leads assigned to inactive salespersons.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.customer_id} className="border-t border-slate-100 hover:bg-amber-50/30">
                      <td className="px-4 py-3 align-top">
                        <Link
                          href={`/${dashboardBase}/view-customer/${row.customer_id}`}
                          className="font-semibold text-amber-800 hover:underline"
                        >
                          {customerName(row)}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span className="font-mono">ID {row.customer_id}</span>
                          {row.phone ? (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" aria-hidden />
                              {row.phone}
                            </span>
                          ) : null}
                          {row.email ? (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3 w-3" aria-hidden />
                              {row.email}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{row.lead_source || "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(row.status)}`}
                        >
                          {formatStatusLabel(row.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatCampaign(row.lead_campaign)}</td>
                      <td className="px-4 py-3 text-slate-700">{row.stage || "—"}</td>
                      <td className="px-4 py-3">
                        <LeadsLastFollowupWithRemark
                          at={row.last_followup_at}
                          notes={row.last_followup_notes}
                        />
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-slate-700" title={row.company || ""}>
                        {row.company || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                        {formatDateCreated(row.date_created)}
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