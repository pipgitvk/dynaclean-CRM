"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
} from "lucide-react";
import { getCurrentMonthRangeIso } from "@/lib/crmDateFormat";
import { resolveSocialMediaLeadOutcomeStatus } from "@/lib/socialMediaLeadOutcomeStatus";

const PAGE_SIZE = 50;

function defaultFilters(monthDefault) {
  return {
    from: monthDefault.from,
    to: monthDefault.to,
    assignedTo: "",
    leadSource: "",
    outcomeTag: "all",
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
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${styles}`}
    >
      {outcome.label}
    </span>
  );
}

function formatCampaign(raw) {
  const s = String(raw || "").trim();
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CrmCampaignLeadsManageClient({
  dashboardBase = "admin-dashboard",
  pageConfig,
}) {
  const { apiPath, title, subtitle, emptyMessage, accent } = pageConfig;
  const monthDefault = useMemo(() => getCurrentMonthRangeIso(), []);
  const hubHref = `/${dashboardBase}/leads-manage`;

  const initialFilters = useMemo(() => defaultFilters(monthDefault), [monthDefault]);
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [page, setPage] = useState(0);

  const [summaryLoading, setSummaryLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total: 0 });
  const [filterOptions, setFilterOptions] = useState({ assignees: [], leadSources: [] });
  const [pagination, setPagination] = useState({ total: 0, hasMore: false });

  const patchDraft = useCallback((patch) => {
    setDraftFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const runSearch = useCallback(() => {
    setAppliedFilters({ ...draftFilters });
    setPage(0);
  }, [draftFilters]);

  const buildListParams = useCallback(
    (overrides = {}) => {
      const { from, to, outcomeTag, assignedTo, leadSource, search } = appliedFilters;
      const params = {
        from: from || monthDefault.from,
        to: to || monthDefault.to,
        outcomeTag,
        limit: PAGE_SIZE,
        skip: page * PAGE_SIZE,
        ...overrides,
      };
      if (assignedTo) params.assignedTo = assignedTo;
      if (leadSource) params.leadSource = leadSource;
      if (search?.trim()) params.search = search.trim();
      return params;
    },
    [appliedFilters, monthDefault.from, monthDefault.to, page],
  );

  const fetchData = useCallback(async () => {
    const pagingOnly = page > 0;
    setTableLoading(true);
    if (!pagingOnly) setSummaryLoading(true);
    try {
      const listParams = buildListParams({
        includeOptions: 0,
        includeSummary: page === 0 ? 1 : 0,
      });
      const listRes = await axios.get(apiPath, { params: listParams });
      if (listRes.data?.success) {
        setRows(listRes.data.data || []);
        if (listRes.data.summary) {
          setSummary(listRes.data.summary);
        }
        setPagination((prev) => {
          const next = listRes.data.pagination || { total: 0, hasMore: false };
          return {
            ...next,
            total: next.total > 0 ? next.total : prev.total,
          };
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTableLoading(false);
      if (!pagingOnly) setSummaryLoading(false);
    }

    if (page === 0) {
      const optionsParams = buildListParams({
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
  }, [apiPath, buildListParams, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const assigneeSelectOptions = useMemo(() => {
    const items = (filterOptions.assignees || []).map((a) => {
      const user = String(a.assignedTo || "").trim();
      return { value: user, label: user || "—" };
    });
    return [{ value: "", label: "All assignees" }, ...items];
  }, [filterOptions.assignees]);

  const leadSourceSelectOptions = useMemo(
    () => [
      { value: "", label: "All lead sources" },
      ...(filterOptions.leadSources || []).map((s) => ({ value: s, label: s })),
    ],
    [filterOptions.leadSources],
  );

  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <Link
          href={hubHref}
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Leads Manage
        </Link>

        <h1 className="text-3xl font-semibold text-gray-900">{title}</h1>
        <p className="text-gray-600 -mt-4">{subtitle}</p>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="text-sm text-gray-500">Total leads (filtered)</div>
          <div className={`text-3xl font-bold mt-1 tabular-nums ${accent.summary}`}>
            {summaryLoading ? "…" : summary.total ?? 0}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Filters</h2>
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Search</label>
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
              placeholder="Customer ID, phone, name, email, company, assignee…"
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 ${accent.focus}`}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">From</label>
              <TypeableDateFilterInput
                value={draftFilters.from}
                onChange={(v) => patchDraft({ from: v })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">To</label>
              <TypeableDateFilterInput
                value={draftFilters.to}
                onChange={(v) => patchDraft({ to: v })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Tag</label>
              <select
                value={draftFilters.outcomeTag}
                onChange={(e) => patchDraft({ outcomeTag: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="all">All</option>
                <option value="won">Won</option>
                <option value="cancel">Cancel</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Assigned to</label>
              <SearchableSelect
                options={assigneeSelectOptions}
                value={draftFilters.assignedTo}
                onChange={(v) => patchDraft({ assignedTo: v })}
                placeholder="All assignees"
                searchPlaceholder="Search assignee..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Lead source</label>
              <SearchableSelect
                options={leadSourceSelectOptions}
                value={draftFilters.leadSource}
                onChange={(v) => patchDraft({ leadSource: v })}
                placeholder="All lead sources"
                searchPlaceholder="Search source..."
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={runSearch}
              disabled={tableLoading || summaryLoading}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${accent.button}`}
            >
              {tableLoading || summaryLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {pagination.total ?? 0} lead{pagination.total === 1 ? "" : "s"}
            </span>
            {tableLoading && <Loader2 className={`w-5 h-5 animate-spin ${accent.spinner}`} />}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Assigned
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Lead source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Campaign
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody
                className={`divide-y divide-gray-100 ${
                  tableLoading && rows.length > 0 ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                {!tableLoading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const customerHref = row.customer_id
                      ? `/${dashboardBase}/view-customer/${encodeURIComponent(row.customer_id)}`
                      : null;
                    return (
                      <tr key={row.customer_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          {customerHref ? (
                            <Link href={customerHref} className={`font-medium ${accent.link}`}>
                              {displayName(row)}
                            </Link>
                          ) : (
                            <span className="font-medium text-gray-900">{displayName(row)}</span>
                          )}
                          <div className="text-xs text-gray-400">#{row.customer_id}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <div>{row.phone || "—"}</div>
                          <div className="text-xs text-gray-500 break-all">{row.email || "—"}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                          <div>{row.assigned_to || "—"}</div>
                          {row.sales_representative &&
                            row.sales_representative !== row.assigned_to && (
                              <div className="text-xs text-gray-500">
                                Rep: {row.sales_representative}
                              </div>
                            )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-800">{row.status || "—"}</div>
                          <OutcomeStatusBadge row={row} />
                        </td>
                        <td className="px-4 py-3 text-gray-700">{row.lead_source || "—"}</td>
                        <td className="px-4 py-3 text-gray-700">{formatCampaign(row.lead_campaign)}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {row.date_created
                            ? new Date(row.date_created).toLocaleString("en-IN", {
                                timeZone: "Asia/Kolkata",
                              })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t flex items-center justify-between bg-gray-50">
            <button
              type="button"
              disabled={page <= 0 || tableLoading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <span className="text-sm text-gray-600">
              Page {page + 1} of {totalPages}
            </span>
            <button
              type="button"
              disabled={!pagination.hasMore || tableLoading}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}