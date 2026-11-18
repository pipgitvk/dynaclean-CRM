"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import dayjs from "dayjs";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Globe,
  Loader2,
  Mail,
  MousePointerClick,
  Phone,
  Search,
  Store,
  TrendingUp,
  User,
  UserCheck,
  Users,
  UserPlus,
  Clock,
  CircleCheck,
  CircleX,
} from "lucide-react";
import { formatCrmDateOnly, getCurrentMonthThroughTodayIso } from "@/lib/crmDateFormat";
import { formatCrmDatetimeForISTDisplay } from "@/lib/timezone";
import { resolveSocialMediaLeadOutcomeStatus } from "@/lib/socialMediaLeadOutcomeStatus";

const PAGE_SIZE = 50;

const PAGE_ICONS = {
  globe: Globe,
  store: Store,
  click: MousePointerClick,
  usercheck: UserCheck,
};

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

function defaultFilters(monthDefault) {
  return {
    from: monthDefault.from,
    to: monthDefault.to,
    assignedTo: "",
    leadSource: "",
    outcomeTag: "all",
    assignmentFilter: "all",
    search: "",
  };
}

function displayName(row) {
  const first = String(row.first_name || "").trim();
  const last = String(row.last_name || "").trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return row.company || "—";
}

function OutcomeStatusBadge({ row }) {
  const outcome = resolveSocialMediaLeadOutcomeStatus({
    crm_customer_id: row.customer_id,
    crm_status: row.status,
    has_dispatched_order: row.has_dispatched_order,
  });
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

function formatCampaign(raw) {
  const s = String(raw || "").trim();
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function FilterField({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-slate-500">{label}</label>
      {children}
    </div>
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

function CampaignSummaryCards({
  summary,
  prevSummary,
  loading,
  sparkColor,
  summaryMode = "assignment",
  activeAssignmentFilter = "all",
  onSelectAssignmentFilter,
  activeOutcomeTag = "all",
  onSelectOutcomeTag,
}) {
  const cards =
    summaryMode === "outcome"
      ? [
          {
            label: "Total Leads",
            outcomeTag: "all",
            value: summary.total,
            prev: prevSummary.total,
            icon: Users,
            iconBg: "bg-violet-100 text-violet-700",
            valueClass: "text-slate-900",
            spark: sparkColor,
            seed: 1,
            activeRing: "ring-violet-500/60",
          },
          {
            label: "Won",
            outcomeTag: "won",
            value: summary.won ?? summary.assigned ?? 0,
            prev: prevSummary.won ?? prevSummary.assigned ?? 0,
            icon: CircleCheck,
            iconBg: "bg-emerald-100 text-emerald-700",
            valueClass: "text-emerald-700",
            spark: "#10b981",
            seed: 2,
            activeRing: "ring-emerald-500/60",
          },
          {
            label: "Cancel",
            outcomeTag: "cancel",
            value: summary.cancel ?? summary.pending ?? 0,
            prev: prevSummary.cancel ?? prevSummary.pending ?? 0,
            icon: CircleX,
            iconBg: "bg-rose-100 text-rose-700",
            valueClass: "text-rose-700",
            spark: "#f43f5e",
            seed: 3,
            activeRing: "ring-rose-500/60",
          },
        ]
      : [
          {
            label: "Total Leads",
            assignmentFilter: "all",
            value: summary.total,
            prev: prevSummary.total,
            icon: Users,
            iconBg: "bg-violet-100 text-violet-700",
            valueClass: "text-slate-900",
            spark: sparkColor,
            seed: 1,
            activeRing: "ring-violet-500/60",
          },
          {
            label: "Assigned",
            assignmentFilter: "assigned",
            value: summary.assigned,
            prev: prevSummary.assigned,
            icon: UserPlus,
            iconBg: "bg-emerald-100 text-emerald-700",
            valueClass: "text-emerald-700",
            spark: "#10b981",
            seed: 2,
            activeRing: "ring-emerald-500/60",
          },
          {
            label: "Pending",
            assignmentFilter: "pending",
            value: summary.pending,
            prev: prevSummary.pending,
            icon: Clock,
            iconBg: "bg-amber-100 text-amber-700",
            valueClass: "text-amber-700",
            spark: "#f59e0b",
            seed: 3,
            activeRing: "ring-amber-500/60",
          },
        ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((c) => {
        const change = pctChange(c.value, c.prev);
        const up = change >= 0;
        const Icon = c.icon;
        const isActive =
          summaryMode === "outcome"
            ? activeOutcomeTag === c.outcomeTag
            : activeAssignmentFilter === c.assignmentFilter;
        return (
          <button
            key={c.label}
            type="button"
            disabled={loading}
            onClick={() => {
              if (summaryMode === "outcome") {
                onSelectOutcomeTag?.(c.outcomeTag);
              } else {
                onSelectAssignmentFilter?.(c.assignmentFilter);
              }
            }}
            className={`cursor-pointer rounded-2xl border bg-white/95 p-5 text-left shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:pointer-events-none disabled:opacity-70 ${
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
              {!loading && <SummarySparkline color={c.spark} value={c.value} seed={c.seed} />}
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

function exportCrmRowsCsv(rows) {
  const header = [
    "Customer ID",
    "Name",
    "Phone",
    "Email",
    "Assigned By",
    "Assigned To",
    "Campaign",
    "Created",
  ];
  const lines = rows.map((row) =>
    [
      row.customer_id,
      displayName(row),
      row.phone || "",
      row.email || "",
      row.assigned_to || "",
      row.lead_source || "",
      row.lead_campaign || "",
      row.date_created || "",
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
  a.download = "crm-leads.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function CrmCampaignLeadsManageClient({
  dashboardBase = "admin-dashboard",
  pageConfig,
}) {
  const {
    apiPath,
    title,
    subtitle,
    emptyMessage,
    accent,
    icon,
    iconGradient,
    sparkColor,
    summaryMode = "assignment",
  } = pageConfig;
  const HeaderIcon = PAGE_ICONS[icon] || Globe;
  const monthDefault = useMemo(() => getCurrentMonthThroughTodayIso(), []);
  const hubHref = `/${dashboardBase}/leads-manage`;

  const initialFilters = useMemo(() => defaultFilters(monthDefault), [monthDefault]);
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [page, setPage] = useState(0);

  const [summaryLoading, setSummaryLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    assigned: 0,
    pending: 0,
    won: 0,
    cancel: 0,
  });
  const [prevSummary, setPrevSummary] = useState({
    total: 0,
    assigned: 0,
    pending: 0,
    won: 0,
    cancel: 0,
  });
  const [filterOptions, setFilterOptions] = useState({ assignees: [], leadSources: [] });
  const [pagination, setPagination] = useState({ total: 0, hasMore: false });

  const draftFiltersRef = useRef(initialFilters);
  useEffect(() => {
    draftFiltersRef.current = draftFilters;
  }, [draftFilters]);

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

  const applyAssignmentFilterFromCard = useCallback((assignmentFilter) => {
    setDraftFilters((prev) => {
      const next = { ...prev, assignmentFilter };
      draftFiltersRef.current = next;
      return next;
    });
    setAppliedFilters((prev) => {
      const next = { ...prev, assignmentFilter };
      return next;
    });
    setPage(0);
  }, []);

  const applyOutcomeTagFromCard = useCallback((outcomeTag) => {
    setDraftFilters((prev) => {
      const next = { ...prev, outcomeTag };
      draftFiltersRef.current = next;
      return next;
    });
    setAppliedFilters((prev) => {
      const next = { ...prev, outcomeTag };
      return next;
    });
    setPage(0);
  }, []);

  const resetFilters = useCallback(() => {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(0);
  }, [initialFilters]);

  const buildListParams = useCallback(
    (filters, pageNum, overrides = {}) => {
      const { from, to, outcomeTag, assignedTo, leadSource, assignmentFilter, search } =
        filters;
      const params = {
        from: from || monthDefault.from,
        to: to || monthDefault.to,
        outcomeTag,
        assignmentFilter: assignmentFilter || "all",
        limit: PAGE_SIZE,
        skip: pageNum * PAGE_SIZE,
        ...overrides,
      };
      if (assignedTo) params.assignedTo = assignedTo;
      if (leadSource) params.leadSource = leadSource;
      if (search?.trim()) params.search = search.trim();
      return params;
    },
    [monthDefault.from, monthDefault.to],
  );

  const fetchData = useCallback(async () => {
    const pagingOnly = page > 0;
    setTableLoading(true);
    if (!pagingOnly) setSummaryLoading(true);
    try {
      const listParams = buildListParams(appliedFilters, page, {
        includeOptions: 0,
        includeSummary: page === 0 ? 1 : 0,
      });
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
        const [listRes, prevRes] = await Promise.all([
          axios.get(apiPath, { params: listParams }),
          axios.get(apiPath, { params: prevParams }),
        ]);
        if (listRes.data?.success) {
          setRows(listRes.data.data || []);
          if (listRes.data.summary) setSummary(listRes.data.summary);
          setPagination(listRes.data.pagination || { total: 0, hasMore: false });
        }
        if (prevRes.data?.success && prevRes.data.summary) {
          setPrevSummary(prevRes.data.summary);
        }
      } else {
        const listRes = await axios.get(apiPath, { params: listParams });
        if (listRes.data?.success) {
          setRows(listRes.data.data || []);
          setPagination(listRes.data.pagination || { total: 0, hasMore: false });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTableLoading(false);
      if (!pagingOnly) setSummaryLoading(false);
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
      const count = Number(a.leadCount ?? 0);
      const label = user ? `${user} (${count.toLocaleString("en-IN")})` : "—";
      return { value: user, label };
    });
    return [{ value: "", label: "All assigned by" }, ...items];
  }, [filterOptions.assignees]);

  const leadSourceSelectOptions = useMemo(
    () => [
      { value: "", label: "All assigned to" },
      ...(filterOptions.leadSources || []).map((item) => {
        const source =
          typeof item === "string" ? item : String(item?.source || "").trim();
        const count = Number(typeof item === "object" ? item?.leadCount : 0) || 0;
        return {
          value: source,
          label: `${source} (${count.toLocaleString("en-IN")})`,
        };
      }),
    ],
    [filterOptions.leadSources],
  );

  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / PAGE_SIZE));

  return (
    <div className="min-h-screen w-full max-w-none bg-gradient-to-b from-violet-50/80 via-slate-50 to-white pb-6 pt-3 sm:pt-4 -mx-2 w-[calc(100%+1rem)] sm:-mx-3 sm:w-[calc(100%+1.5rem)] md:-mx-4 md:w-[calc(100%+2rem)] px-1 sm:px-2">
      <div className="w-full space-y-5">
        <Link
          href={hubHref}
          className="inline-flex items-center gap-2 text-base font-semibold text-violet-700 hover:text-violet-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Leads Manage
        </Link>

        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div
              className={`shrink-0 rounded-[14px] bg-gradient-to-br p-3 shadow-md shadow-violet-500/20 ${iconGradient}`}
            >
              <HeaderIcon className="h-6 w-6 text-white" strokeWidth={2.25} aria-hidden />
            </div>
            <div className="min-w-0 pt-0.5">
              <h1 className="text-2xl font-bold tracking-tight text-indigo-950 sm:text-3xl">
                {title}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-snug text-slate-500 sm:text-base">
                {subtitle}
              </p>
            </div>
          </div>
          <HeaderIcon
            className="hidden h-16 w-16 shrink-0 text-violet-300/40 sm:block"
            strokeWidth={1.25}
            aria-hidden
          />
        </header>

        <CampaignSummaryCards
          summary={summary}
          prevSummary={prevSummary}
          loading={summaryLoading}
          sparkColor={sparkColor || "#8b5cf6"}
          summaryMode={summaryMode}
          activeAssignmentFilter={appliedFilters.assignmentFilter || "all"}
          onSelectAssignmentFilter={applyAssignmentFilterFromCard}
          activeOutcomeTag={appliedFilters.outcomeTag || "all"}
          onSelectOutcomeTag={applyOutcomeTagFromCard}
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
                className={`rounded-lg border bg-white px-4 py-2 text-base font-semibold ${accent.resetBorder} ${accent.resetText} ${accent.resetHover}`}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={runSearch}
                disabled={tableLoading || summaryLoading}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-base font-semibold text-white disabled:opacity-60 ${accent.button}`}
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
              placeholder="Customer ID, phone, name, email, company, assigned by…"
              className={`w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-base focus:outline-none focus:ring-2 ${accent.ring}`}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
            <FilterField label="Assigned By">
              <SearchableSelect
                options={assigneeSelectOptions}
                value={draftFilters.assignedTo}
                onChange={(v) => patchDraft({ assignedTo: v })}
                placeholder="All assigned by"
                searchPlaceholder="Search assigned by..."
                className="rounded-xl border-slate-200"
              />
            </FilterField>
            <FilterField label="Assigned To">
              <SearchableSelect
                options={leadSourceSelectOptions}
                value={draftFilters.leadSource}
                onChange={(v) => patchDraft({ leadSource: v })}
                placeholder="All assigned to"
                searchPlaceholder="Search assigned to..."
                className="rounded-xl border-slate-200"
              />
            </FilterField>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
            <span className="text-base font-bold text-slate-800">
              {pagination.total ?? 0} Leads (Filtered)
            </span>
            <div className="flex items-center gap-2">
              {tableLoading && <Loader2 className={`h-5 w-5 animate-spin ${accent.spinner}`} />}
              <button
                type="button"
                onClick={() => exportCrmRowsCsv(rows)}
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
                  <th className="w-10 px-4 py-3">#</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Assigned By</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody
                className={`divide-y divide-slate-100 ${
                  tableLoading && rows.length > 0 ? "pointer-events-none opacity-50" : ""
                }`}
              >
                {!tableLoading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center text-slate-500">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => {
                    const name = displayName(row);
                    const customerHref = row.customer_id
                      ? `/${dashboardBase}/view-customer/${encodeURIComponent(row.customer_id)}`
                      : null;
                    return (
                      <tr key={row.customer_id} className="hover:bg-violet-50/20">
                        <td className="px-4 py-3 text-slate-400 tabular-nums">
                          {page * PAGE_SIZE + idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-800">
                              {leadInitials(name)}
                            </div>
                            <div className="min-w-0">
                              {customerHref ? (
                                <Link
                                  href={customerHref}
                                  className={`font-semibold ${accent.link}`}
                                >
                                  {name}
                                </Link>
                              ) : (
                                <span className="font-semibold text-slate-900">{name}</span>
                              )}
                              <div className="text-xs text-slate-400 sm:text-sm">#{row.customer_id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            {row.phone || "—"}
                          </div>
                          <div className="mt-0.5 flex items-start gap-1.5 break-all text-sm text-slate-500">
                            <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                            {row.email || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-800">
                          <div className="flex items-center gap-1.5 font-medium">
                            <User className="h-3.5 w-3.5 text-violet-500" />
                            {row.assigned_to || "—"}
                          </div>
                          {row.sales_representative &&
                            row.sales_representative !== row.assigned_to && (
                              <div className="text-sm text-slate-500">
                                Rep: {row.sales_representative}
                              </div>
                            )}
                        </td>
                        <td className="px-4 py-3">
                          <OutcomeStatusBadge row={row} />
                        </td>
                        <td className="px-4 py-3 text-slate-700">{row.lead_source || "—"}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatCampaign(row.lead_campaign)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          <div className="text-sm">
                            <div className="flex items-center gap-1.5 font-medium text-slate-700">
                              <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                              {row.date_created
                                ? formatCrmDatetimeForISTDisplay(row.date_created) ||
                                  formatCrmDateOnly(String(row.date_created).slice(0, 10))
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
              disabled={page <= 0 || tableLoading}
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
              disabled={!pagination.hasMore || tableLoading}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-base disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}