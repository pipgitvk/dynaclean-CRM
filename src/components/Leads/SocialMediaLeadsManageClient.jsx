"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import SearchableSelect from "@/components/ui/SearchableSelect";
import dayjs from "dayjs";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Loader2,
  Mail,
  Megaphone,
  Phone,
  Search,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { formatCrmDateOnly, getCurrentMonthThroughTodayIso } from "@/lib/crmDateFormat";
import { formatCrmDatetimeForISTDisplay } from "@/lib/timezone";
import { resolveSocialMediaLeadOutcomeStatus } from "@/lib/socialMediaLeadOutcomeStatus";
import MetaFormDistributionPicker from "@/components/Leads/MetaFormDistributionPicker";

const PAGE_SIZE = 50;

function previousPeriodRange(from, to) {
  const start = dayjs(from);
  const end = dayjs(to);
  const span = Math.max(1, end.diff(start, "day") + 1);
  const prevEnd = start.subtract(1, "day");
  const prevStart = prevEnd.subtract(span - 1, "day");
  return {
    from: prevStart.format("YYYY-MM-DD"),
    to: prevEnd.format("YYYY-MM-DD"),
  };
}

function pctChange(current, previous) {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

function leadInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function sparkSeries(seed, value) {
  const base = Math.max(1, Number(value) || 0);
  return Array.from({ length: 12 }, (_, i) => ({
    i,
    v: Math.round(base * (0.55 + ((seed + i * 7) % 40) / 100)),
  }));
}

function defaultSocialMediaFilters(monthDefault) {
  return {
    from: monthDefault.from,
    to: monthDefault.to,
    importStatus: "all",
    assignedTo: "",
    campaign: "",
    outcomeTag: "all",
    search: "",
  };
}

function socialMediaFiltersStorageKey(dashboardBase) {
  return `leads-manage:social-media:filters:${dashboardBase || "admin-dashboard"}`;
}

function readStoredSocialMediaFilters(dashboardBase, monthDefault) {
  const defaults = defaultSocialMediaFilters(monthDefault);
  if (typeof window === "undefined") return defaults;
  try {
    const raw = sessionStorage.getItem(socialMediaFiltersStorageKey(dashboardBase));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaults;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function writeStoredSocialMediaFilters(dashboardBase, filters) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      socialMediaFiltersStorageKey(dashboardBase),
      JSON.stringify(filters),
    );
  } catch {
    /* ignore quota */
  }
}

function clearStoredSocialMediaFilters(dashboardBase) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(socialMediaFiltersStorageKey(dashboardBase));
  } catch {
    /* ignore */
  }
}

function getLeadName(lead) {
  const fieldData = lead.fieldData || lead.field_data || [];
  if (!Array.isArray(fieldData)) {
    const ld = lead.leadData || {};
    return ld.full_name || ld.first_name || "—";
  }
  const firstName = fieldData.find((f) => f.name === "first_name")?.values?.[0] || "";
  const lastName = fieldData.find((f) => f.name === "last_name")?.values?.[0] || "";
  const fullName = fieldData.find((f) => f.name === "full_name")?.values?.[0] || "";
  if (fullName) return fullName;
  if (firstName && lastName) return `${firstName} ${lastName}`;
  return firstName || lastName || lead.leadData?.first_name || "—";
}

function getLeadPhone(lead) {
  const fieldData = lead.fieldData || lead.field_data || [];
  const phone =
    (Array.isArray(fieldData) &&
      fieldData.find((f) => f.name === "phone_number")?.values?.[0]) ||
    lead.leadData?.phone ||
    "";
  return phone || "—";
}

function getLeadEmail(lead) {
  const fieldData = lead.fieldData || lead.field_data || [];
  const email =
    (Array.isArray(fieldData) && fieldData.find((f) => f.name === "email")?.values?.[0]) ||
    lead.leadData?.email ||
    "";
  return email || "—";
}

function OutcomeStatusBadge({ lead }) {
  const outcome = resolveSocialMediaLeadOutcomeStatus(lead);
  if (!outcome.label) return null;
  const styles =
    outcome.tone === "won"
      ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
      : "bg-rose-100 text-rose-800 ring-rose-200";
  return (
    <div className="min-w-0">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ${styles}`}
      >
        {outcome.label}
      </span>
      {outcome.tone === "cancel" && outcome.crmStatus ? (
        <div
          className="mt-1 max-w-[12rem] truncate text-xs font-medium text-slate-600 sm:text-sm"
          title={outcome.crmStatus}
        >
          {outcome.crmStatus}
        </div>
      ) : null}
    </div>
  );
}

function distributionLabel(lead) {
  if (lead.is_imported_to_crm || lead.isImportedToCRM) {
    const who =
      lead.crm_assigned_to ||
      lead.crm_lead_source ||
      lead.crm_sales_rep ||
      lead.assigned_to ||
      "—";
    return { status: "Distributed", tone: "green", assignee: who };
  }
  return {
    status: "Duplicate",
    tone: "red",
    assignee: lead.assigned_to || lead.employee_name || "—",
  };
}

export default function SocialMediaLeadsManageClient({
  dashboardBase = "admin-dashboard",
  apiPath = "/api/leads-manage/social-media",
  pageTitle = "Social Media Leads",
  pageSubtitle =
    "Unique Meta enquiries (month + date filter). All social-channel leads, including manual CRM assignments.",
}) {
  const monthDefault = useMemo(() => getCurrentMonthThroughTodayIso(), []);
  const hubHref = `/${dashboardBase}/leads-manage`;

  const defaultFilters = useMemo(
    () => defaultSocialMediaFilters(monthDefault),
    [monthDefault],
  );
  const [draftFilters, setDraftFilters] = useState(() =>
    readStoredSocialMediaFilters(dashboardBase, monthDefault),
  );
  const [appliedFilters, setAppliedFilters] = useState(() =>
    readStoredSocialMediaFilters(dashboardBase, monthDefault),
  );
  const [page, setPage] = useState(0);

  const [summaryLoading, setSummaryLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total: 0, imported: 0, notImported: 0 });
  const [prevSummary, setPrevSummary] = useState({ total: 0, imported: 0, notImported: 0 });
  const [filterOptions, setFilterOptions] = useState({ assignees: [], campaigns: [] });
  const [pagination, setPagination] = useState({ total: 0, hasMore: false });

  const draftFiltersRef = useRef(draftFilters);
  useEffect(() => {
    draftFiltersRef.current = draftFilters;
  }, [draftFilters]);

  useEffect(() => {
    writeStoredSocialMediaFilters(dashboardBase, {
      ...appliedFilters,
      from: draftFilters.from || appliedFilters.from,
      to: draftFilters.to || appliedFilters.to,
    });
  }, [appliedFilters, draftFilters.from, draftFilters.to, dashboardBase]);

  const patchDraft = useCallback((patch) => {
    setDraftFilters((prev) => {
      const next = { ...prev, ...patch };
      draftFiltersRef.current = next;
      return next;
    });
  }, []);

  const runSearch = useCallback(() => {
    const next = { ...draftFiltersRef.current };
    setAppliedFilters(next);
    setPage(0);
  }, []);

  const applyImportStatusFromCard = useCallback((importStatus) => {
    setDraftFilters((prev) => {
      const next = { ...prev, importStatus };
      draftFiltersRef.current = next;
      return next;
    });
    setAppliedFilters((prev) => {
      const next = { ...prev, importStatus };
      return next;
    });
    setPage(0);
  }, []);

  const buildListParams = useCallback(
    (filters, pageNum, overrides = {}) => {
      const {
        from,
        to,
        importStatus,
        outcomeTag,
        assignedTo,
        campaign,
        search,
      } = filters;
      const fromIso = String(from || "").trim();
      const toIso = String(to || "").trim();
      const params = {
        from: fromIso || monthDefault.from,
        to: toIso || monthDefault.to,
        importStatus,
        outcomeTag,
        limit: PAGE_SIZE,
        skip: pageNum * PAGE_SIZE,
        ...overrides,
      };
      if (assignedTo) params.assignedTo = assignedTo;
      if (campaign) params.campaign = campaign;
      if (search?.trim()) params.search = search.trim();
      return params;
    },
    [monthDefault.from, monthDefault.to],
  );

  const resetFilters = useCallback(() => {
    clearStoredSocialMediaFilters(dashboardBase);
    setDraftFilters(defaultFilters);
    draftFiltersRef.current = defaultFilters;
    setAppliedFilters(defaultFilters);
    setPage(0);
  }, [dashboardBase, defaultFilters]);

  const fetchData = useCallback(async () => {
    const pagingOnly = page > 0;
    setTableLoading(true);
    if (!pagingOnly) {
      setSummaryLoading(true);
    }
    try {
      const listParams = buildListParams(appliedFilters, page, {
        includeOptions: 0,
        includeSummary: page === 0 ? 1 : 0,
      });
      let prevRes = null;
      if (page === 0) {
        const prev = previousPeriodRange(
          appliedFilters.from || monthDefault.from,
          appliedFilters.to || monthDefault.to,
        );
        const prevParams = buildListParams(
          { ...appliedFilters, from: prev.from, to: prev.to },
          0,
          { includeOptions: 0, includeSummary: 1, limit: 1 },
        );
        const [listResult, prevResult] = await Promise.all([
          axios.get(apiPath, { params: listParams }),
          axios.get(apiPath, { params: prevParams }),
        ]);
        prevRes = prevResult;
        if (listResult.data?.success) {
          setRows(listResult.data.data || []);
          if (listResult.data.summary) setSummary(listResult.data.summary);
          setPagination(listResult.data.pagination || { total: 0, hasMore: false });
        }
      } else {
        const listResult = await axios.get(apiPath, { params: listParams });
        if (listResult.data?.success) {
          setRows(listResult.data.data || []);
          setPagination(listResult.data.pagination || { total: 0, hasMore: false });
        }
      }
      if (prevRes?.data?.success && prevRes.data.summary) {
        setPrevSummary(prevRes.data.summary);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setTableLoading(false);
      if (!pagingOnly) {
        setSummaryLoading(false);
      }
    }

    if (page === 0) {
      const optionsParams = buildListParams(appliedFilters, 0, {
        skip: 0,
        includeSummary: 0,
        includeOptions: 1,
        optionsOnly: 1,
      });
      axios
        .get(apiPath, { params: optionsParams })
        .then((optionsRes) => {
          if (optionsRes.data?.success && optionsRes.data.filterOptions) {
            setFilterOptions(optionsRes.data.filterOptions);
          }
        })
        .catch((err) => console.error(err));
    }
  }, [apiPath, appliedFilters, buildListParams, monthDefault.from, monthDefault.to, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const assigneeSelectOptions = useMemo(() => {
    const items = (filterOptions.assignees || []).map((a) => {
      const user = String(a.assignedTo || "").trim();
      const name = String(a.employeeName || "").trim();
      const display = name || user || "—";
      const count = Number(a.leadCount ?? 0);
      const label = `${display} (${count.toLocaleString("en-IN")})`;
      return { value: user, label };
    });
    return [{ value: "", label: "All users" }, ...items];
  }, [filterOptions.assignees]);

  const campaignSelectOptions = useMemo(
    () => [
      { value: "", label: "All campaigns" },
      ...(filterOptions.campaigns || []).map((c) => ({ value: c, label: c })),
    ],
    [filterOptions.campaigns],
  );

  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / PAGE_SIZE));

  return (
    <div className="min-h-screen w-full max-w-none bg-gradient-to-b from-violet-50/80 via-slate-50 to-white pb-6 pt-3 sm:pt-4 -mx-2 w-[calc(100%+1rem)] sm:-mx-3 sm:w-[calc(100%+1.5rem)] md:-mx-4 md:w-[calc(100%+2rem)] px-1 sm:px-2">
      <div className="w-full space-y-5">
        <LeadsManageBackLink hubHref={hubHref} />

        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="shrink-0 rounded-[14px] bg-gradient-to-br from-pink-500 to-violet-600 p-3 shadow-md shadow-violet-500/25">
              <Megaphone className="h-6 w-6 text-white" strokeWidth={2.25} aria-hidden />
            </div>
            <div className="min-w-0 pt-0.5">
              <h1 className="text-2xl font-bold tracking-tight text-indigo-950 sm:text-3xl">
                {pageTitle}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-snug text-slate-500 sm:text-base">
                {pageSubtitle}
              </p>
            </div>
          </div>
          <div className="relative z-30 flex shrink-0 flex-col items-stretch sm:items-end sm:pt-1">
            <MetaFormDistributionPicker />
          </div>
        </header>

        <SocialMediaSummaryCards
          summary={summary}
          prevSummary={prevSummary}
          loading={summaryLoading}
          activeImportStatus={appliedFilters.importStatus}
          onSelectImportStatus={applyImportStatusFromCard}
        />

        <div className="relative z-20 overflow-visible rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm backdrop-blur-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="inline-flex items-center gap-2 text-base font-bold text-slate-800">
              <Filter className="h-4 w-4 text-violet-600" />
              Filters
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-lg border border-violet-200 bg-white px-4 py-2 text-base font-semibold text-violet-700 hover:bg-violet-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={runSearch}
                disabled={tableLoading || summaryLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-base font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {(tableLoading || summaryLoading) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Apply Filters
              </button>
            </div>
          </div>
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={draftFilters.search}
              onChange={(e) => patchDraft({ search: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runSearch();
                }
              }}
              placeholder="Customer ID, phone, name, email, Meta lead ID, campaign, assignee…"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-500/25"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <FilterField label="From">
              <TypeableDateFilterInput
                value={draftFilters.from}
                onChange={(v) => patchDraft({ from: v })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base"
              />
            </FilterField>
            <FilterField label="To">
              <TypeableDateFilterInput
                value={draftFilters.to}
                onChange={(v) => patchDraft({ to: v })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base"
              />
            </FilterField>
            <FilterField label="Distribution Status">
              <select
                value={draftFilters.importStatus}
                onChange={(e) => patchDraft({ importStatus: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base"
              >
                <option value="all">All leads</option>
                <option value="distributed">Distributed</option>
                <option value="duplicate">Duplicate</option>
              </select>
            </FilterField>
            <FilterField label="Tag">
              <select
                value={draftFilters.outcomeTag}
                onChange={(e) => patchDraft({ outcomeTag: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base"
              >
                <option value="all">All</option>
                <option value="won">Won</option>
                <option value="cancel">Cancel</option>
              </select>
            </FilterField>
            <FilterField label="Assigned User">
              <SearchableSelect
                options={assigneeSelectOptions}
                value={draftFilters.assignedTo}
                onChange={(v) => patchDraft({ assignedTo: v })}
                placeholder="All users"
                searchPlaceholder="Search user..."
                className="rounded-xl border-slate-200"
              />
            </FilterField>
            <FilterField label="Ads Campaign">
              <SearchableSelect
                options={campaignSelectOptions}
                value={draftFilters.campaign}
                onChange={(v) => patchDraft({ campaign: v })}
                placeholder="All campaigns"
                searchPlaceholder="Search campaign..."
                className="rounded-xl border-slate-200"
              />
            </FilterField>
          </div>
        </div>

        <SocialMediaLeadsTable
          loading={tableLoading}
          rows={rows}
          dashboardBase={dashboardBase}
          page={page}
          setPage={setPage}
          totalPages={totalPages}
          pagination={pagination}
        />
      </div>
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function LeadsManageBackLink({ hubHref }) {
  return (
    <Link
      href={hubHref}
      className="inline-flex items-center gap-2 text-base font-semibold text-violet-700 hover:text-violet-900"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Leads Manage
    </Link>
  );
}

function SummarySparkline({ color, value, seed }) {
  const data = sparkSeries(seed, value);
  return (
    <div className="h-14 w-28 opacity-90">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            fill={color}
            fillOpacity={0.18}
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SocialMediaSummaryCards({
  summary,
  prevSummary,
  loading,
  activeImportStatus = "all",
  onSelectImportStatus,
}) {
  const active =
    activeImportStatus === "imported"
      ? "distributed"
      : activeImportStatus === "not_imported"
        ? "duplicate"
        : activeImportStatus;

  const cards = [
    {
      label: "Total Leads",
      importStatus: "all",
      value: summary.total,
      prev: prevSummary.total,
      icon: Users,
      iconBg: "bg-violet-100 text-violet-700",
      valueClass: "text-slate-900",
      spark: "#7c3aed",
      seed: 1,
      activeRing: "ring-violet-500/60",
    },
    {
      label: "Distributed",
      importStatus: "distributed",
      value: summary.imported,
      prev: prevSummary.imported,
      icon: Download,
      iconBg: "bg-emerald-100 text-emerald-700",
      valueClass: "text-emerald-700",
      spark: "#10b981",
      seed: 2,
      activeRing: "ring-emerald-500/60",
    },
    {
      label: "Duplicate",
      importStatus: "duplicate",
      value: summary.notImported,
      prev: prevSummary.notImported,
      icon: Ban,
      iconBg: "bg-rose-100 text-rose-700",
      valueClass: "text-rose-600",
      spark: "#f43f5e",
      seed: 3,
      activeRing: "ring-rose-500/60",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((c) => {
        const change = pctChange(c.value, c.prev);
        const up = change >= 0;
        const Icon = c.icon;
        const isActive = active === c.importStatus;
        return (
          <button
            key={c.label}
            type="button"
            disabled={loading}
            onClick={() => onSelectImportStatus?.(c.importStatus)}
            className={`cursor-pointer rounded-2xl border bg-white/95 p-5 text-left shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-70 ${
              isActive
                ? `border-violet-300 ring-2 ${c.activeRing} shadow-md`
                : "border-slate-200/90 hover:border-violet-200"
            }`}
            aria-pressed={isActive}
          >
            <div className="flex items-start justify-between gap-3">
              <div className={`rounded-xl p-2.5 ${c.iconBg}`}>
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              {!loading && (
                <SummarySparkline color={c.spark} value={c.value} seed={c.seed} />
              )}
            </div>
            <div className="mt-3 text-base font-medium text-slate-500">{c.label}</div>
            <div className={`mt-1 text-4xl font-bold tabular-nums ${c.valueClass}`}>
              {loading ? "…" : Number(c.value || 0).toLocaleString("en-IN")}
            </div>
            <p
              className={`mt-2 inline-flex items-center gap-1 text-sm font-semibold ${
                up ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              <TrendingUp className={`h-3.5 w-3.5 ${up ? "" : "rotate-180"}`} />
              {up ? "+" : ""}
              {change}% vs previous period
            </p>
          </button>
        );
      })}
    </div>
  );
}

function DistributionStatusPill({ lead }) {
  const distributed = lead.is_imported_to_crm || lead.isImportedToCRM;
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ${
        distributed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
      }`}
    >
      {distributed ? "Distributed" : "Duplicate"}
    </span>
  );
}

function exportLeadsCsv(rows) {
  const header = ["Name", "Leadgen ID", "Phone", "Email", "Campaign", "Created"];
  const lines = rows.map((lead) =>
    [
      getLeadName(lead),
      lead.leadgen_id || "",
      getLeadPhone(lead),
      getLeadEmail(lead),
      lead.campaign_name || "",
      lead.created_at || "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "social-media-leads.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function SocialMediaLeadsTable({ loading, rows, dashboardBase, page, setPage, totalPages, pagination }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <span className="text-base font-bold text-slate-800">
          {pagination.total ?? 0} Leads (Filtered)
        </span>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-5 w-5 animate-spin text-violet-600" />}
          <button
            type="button"
            onClick={() => exportLeadsCsv(rows)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-base">
          <thead>
            <tr className="bg-slate-50/90 text-left text-xs font-bold uppercase tracking-wide text-slate-500 sm:text-sm">
              <th className="px-4 py-3 w-10">#</th>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Meta Assignee</th>
              <th className="px-4 py-3">Distribution</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ads Campaign</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody
            className={`divide-y divide-slate-100 ${
              loading && rows.length > 0 ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-14 text-center text-slate-500">
                  No leads match these filters
                </td>
              </tr>
            ) : (
              rows.map((lead, idx) => {
                const dist = distributionLabel(lead);
                const name = getLeadName(lead);
                const customerId = lead.crm_customer_id;
                const customerHref =
                  customerId &&
                  `/${dashboardBase}/view-customer/${encodeURIComponent(customerId)}`;
                return (
                  <tr key={lead.id || lead.leadgen_id} className="hover:bg-violet-50/20">
                    <td className="px-4 py-3 text-slate-400 tabular-nums">
                      {page * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-800">
                          {leadInitials(name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900">{name}</div>
                          <div className="max-w-[180px] truncate font-mono text-xs text-slate-400 sm:text-sm">
                            {lead.leadgen_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {getLeadPhone(lead)}
                      </div>
                      <div className="mt-0.5 flex items-start gap-1.5 break-all text-sm text-slate-500">
                        <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        {getLeadEmail(lead)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      <div className="flex items-center gap-1.5 font-medium">
                        <User className="h-3.5 w-3.5 text-violet-500" />
                        {lead.employee_name || "—"}
                      </div>
                      <div className="text-sm text-slate-500">{lead.assigned_to || "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <DistributionStatusPill lead={lead} />
                      <div className="mt-1 text-sm text-slate-600">To: {dist.assignee}</div>
                      {customerHref && (
                        <Link href={customerHref} className="text-sm font-medium text-violet-700 hover:underline">
                          CRM #{customerId}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <OutcomeStatusBadge lead={lead} />
                    </td>
                    <td className="max-w-[200px] px-4 py-3 text-slate-700">
                      <span className="line-clamp-2">{lead.campaign_name || "—"}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      <div className="text-sm">
                        <div className="flex items-center gap-1.5 font-medium text-slate-700">
                          <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                          {lead.created_at
                            ? formatCrmDatetimeForISTDisplay(lead.created_at) ||
                              formatCrmDateOnly(String(lead.created_at).slice(0, 10))
                            : "—"}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-4 py-3">
        <button
          type="button"
          disabled={page <= 0 || loading}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-base disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>
        <span className="text-base text-slate-600">
          Page {page + 1} of {totalPages}
        </span>
        <button
          type="button"
          disabled={!pagination.hasMore || loading}
          onClick={() => setPage((p) => p + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-base disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}