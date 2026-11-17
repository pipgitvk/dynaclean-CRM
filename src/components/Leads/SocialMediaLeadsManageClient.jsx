"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
  ArrowLeft,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  XCircle,
} from "lucide-react";
import { getCurrentMonthRangeIso } from "@/lib/crmDateFormat";
import { resolveSocialMediaLeadOutcomeStatus } from "@/lib/socialMediaLeadOutcomeStatus";

const PAGE_SIZE = 50;

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
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${styles}`}
    >
      {outcome.label}
    </span>
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
    return { status: "Imported", tone: "green", assignee: who };
  }
  return {
    status: "Not imported",
    tone: "red",
    assignee: lead.assigned_to || lead.employee_name || "—",
  };
}

export default function SocialMediaLeadsManageClient({
  dashboardBase = "admin-dashboard",
  apiPath = "/api/leads-manage/social-media",
  pageTitle = "Social Media Leads",
  pageSubtitle = "Meta unique enquiries (month + DATE filter). Saari social-channel leads — manual CRM assign bhi include.",
}) {
  const monthDefault = useMemo(() => getCurrentMonthRangeIso(), []);
  const hubHref = `/${dashboardBase}/leads-manage`;

  const initialFilters = useMemo(
    () => defaultSocialMediaFilters(monthDefault),
    [monthDefault],
  );
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [page, setPage] = useState(0);

  const [summaryLoading, setSummaryLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total: 0, imported: 0, notImported: 0 });
  const [filterOptions, setFilterOptions] = useState({ assignees: [], campaigns: [] });
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
      const {
        from,
        to,
        importStatus,
        outcomeTag,
        assignedTo,
        campaign,
        search,
      } = appliedFilters;
      const params = {
        from: from || monthDefault.from,
        to: to || monthDefault.to,
        importStatus,
        outcomeTag,
        limit: PAGE_SIZE,
        skip: page * PAGE_SIZE,
        ...overrides,
      };
      if (assignedTo) params.assignedTo = assignedTo;
      if (campaign) params.campaign = campaign;
      if (search?.trim()) params.search = search.trim();
      return params;
    },
    [appliedFilters, monthDefault.from, monthDefault.to, page],
  );

  const fetchData = useCallback(async () => {
    const pagingOnly = page > 0;
    setTableLoading(true);
    if (!pagingOnly) {
      setSummaryLoading(true);
    }
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
        setPagination(listRes.data.pagination || { total: 0, hasMore: false });
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
      const name = String(a.employeeName || "").trim();
      const label =
        name && user && name.toLowerCase() !== user.toLowerCase()
          ? `${name} (${user})`
          : name || user || "—";
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
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <LeadsManageBackLink hubHref={hubHref} />

        <h1 className="text-3xl font-semibold text-gray-900">{pageTitle}</h1>
        <p className="text-gray-600 -mt-4">{pageSubtitle}</p>

        <SocialMediaSummaryCards summary={summary} loading={summaryLoading} />

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
              placeholder="Customer ID, phone, name, email, Meta lead ID, campaign, assignee…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
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
              <label className="text-xs font-medium text-gray-600 mb-1 block">Import status</label>
              <select
                value={draftFilters.importStatus}
                onChange={(e) => patchDraft({ importStatus: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="all">All leads</option>
                <option value="imported">Imported only</option>
                <option value="not_imported">Not imported only</option>
              </select>
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
              <label className="text-xs font-medium text-gray-600 mb-1 block">Assigned user</label>
              <SearchableSelect
                options={assigneeSelectOptions}
                value={draftFilters.assignedTo}
                onChange={(v) => patchDraft({ assignedTo: v })}
                placeholder="All users"
                searchPlaceholder="Search user..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Ads campaign</label>
              <SearchableSelect
                options={campaignSelectOptions}
                value={draftFilters.campaign}
                onChange={(v) => patchDraft({ campaign: v })}
                placeholder="All campaigns"
                searchPlaceholder="Search campaign..."
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={runSearch}
              disabled={tableLoading || summaryLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
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

function LeadsManageBackLink({ hubHref }) {
  return (
    <Link
      href={hubHref}
      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to Leads Manage
    </Link>
  );
}

function SocialMediaSummaryCards({ summary, loading }) {
  const cards = [
    { label: "Total Leads", value: summary.total, className: "text-gray-900" },
    { label: "Imported", value: summary.imported, className: "text-green-600" },
    { label: "Not Imported", value: summary.notImported, className: "text-red-600" },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="text-sm text-gray-500">{c.label}</div>
          <div className={`text-3xl font-bold mt-1 tabular-nums ${c.className}`}>
            {loading ? "…" : c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function SocialMediaLeadsTable({ loading, rows, dashboardBase, page, setPage, totalPages, pagination }) {
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          {pagination.total ?? 0} lead{pagination.total === 1 ? "" : "s"} (filtered)
        </span>
        {loading && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                Lead
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                Contact
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                Meta assignee
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                Distribution
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                Ads campaign
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                Created
              </th>
            </tr>
          </thead>
          <tbody
            className={`divide-y divide-gray-100 ${
              loading && rows.length > 0 ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  No leads match these filters
                </td>
              </tr>
            ) : (
              rows.map((lead) => {
                const dist = distributionLabel(lead);
                const customerHref =
                  lead.crm_customer_id &&
                  `/${dashboardBase}/view-customer/${encodeURIComponent(lead.crm_customer_id)}`;
                return (
                  <tr key={lead.id || lead.leadgen_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{getLeadName(lead)}</div>
                      <div className="text-xs text-gray-400 font-mono truncate max-w-[180px]">
                        {lead.leadgen_id}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{getLeadPhone(lead)}</div>
                      <div className="text-xs text-gray-500 break-all">{getLeadEmail(lead)}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      <div>{lead.employee_name || "—"}</div>
                      <div className="text-xs text-gray-500">{lead.assigned_to || "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          dist.tone === "green" ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {dist.tone === "green" ? (
                          <CheckCircle className="w-3.5 h-3.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        {dist.status}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">To: {dist.assignee}</div>
                      {customerHref && (
                        <Link href={customerHref} className="text-xs text-blue-600 hover:underline">
                          CRM #{lead.crm_customer_id}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <OutcomeStatusBadge lead={lead} />
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[200px]">
                      <span className="line-clamp-2">{lead.campaign_name || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {lead.created_at
                        ? new Date(lead.created_at).toLocaleString("en-IN", {
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
          disabled={page <= 0 || loading}
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
          disabled={!pagination.hasMore || loading}
          onClick={() => setPage((p) => p + 1)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}