"use client";

import {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Eye, Pencil, Search, X } from "lucide-react";
import ProspectsSearchBar from "./ProspectsSearchBar";
// import { deleteProspect } from "./actions";
import {
  buildProspectsRowsApiUrl,
  extractQuoteNumberFromProspectSearch,
} from "@/lib/prospectFilterUtils";
import { aggregateProspectsByEmployee } from "@/lib/prospectEmployeeAggregates";

function formatAmount(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatNotesPreview(text, maxLen = 72) {
  if (text == null || String(text).trim() === "") return "—";
  const s = String(text).replace(/\s+/g, " ").trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}…`;
}

/** Tokens inside parentheses (e.g. DV-30); skip (Qty n). */
function parseModelCodes(modelText) {
  if (modelText == null || String(modelText).trim() === "") {
    return { codes: [], fallback: null };
  }
  const s = String(modelText);
  const re = /\(([^)]+)\)/g;
  const seen = new Set();
  const codes = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    const inner = m[1].trim();
    if (!inner) continue;
    if (/^Qty\s*\d+$/i.test(inner)) continue;
    const key = inner.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    codes.push(inner);
  }
  if (codes.length > 0) return { codes, fallback: null };
  const fb = s.replace(/\s+/g, " ").trim();
  return { codes: [], fallback: fb || null };
}

function ModelCodesChips({ rowId, model }) {
  const { codes, fallback } = parseModelCodes(model);
  if (codes.length > 0) {
    return (
      <div className="flex flex-wrap gap-1.5 py-0.5">
        {codes.map((code, idx) => (
          <span
            key={`${rowId}-code-${idx}`}
            className="inline-flex max-w-full items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium tracking-tight text-slate-800 shadow-sm"
          >
            <span className="truncate" title={code}>
              {code}
            </span>
          </span>
        ))}
      </div>
    );
  }
  if (fallback) {
    return <span className="text-slate-700">{fallback}</span>;
  }
  return <span className="text-slate-400">—</span>;
}

function formatSuggestionSubtitle(s) {
  const name =
    s.client_name ||
    [s.first_name, s.last_name].filter(Boolean).join(" ").trim();
  const parts = [];
  if (s.quote_number) parts.push(s.quote_number);
  if (name) parts.push(name);
  if (s.phone) parts.push(s.phone);
  return parts.length ? parts.join(" · ") : "";
}

function canDeleteProspectRow(row, viewerIsAdmin, viewerUsername) {
  if (viewerIsAdmin) return true;
  if (!viewerUsername || !row?.created_by) return false;
  return String(row.created_by) === viewerUsername;
}

function buildSelectedFromIdsAndQuotes(customerIds, quoteNumbers = []) {
  return customerIds.map((id, idx) => ({
    customer_id: id,
    subtitle: "",
    quote_number: quoteNumbers[idx] || undefined,
  }));
}

function normalizeAdminFilterState(initial) {
  if (!initial) {
    return {
      commitmentYear: null,
      commitmentMonth: null,
      commitmentDay: null,
      createdBy: null,
      adminSearch: null,
      tlFollowupOnly: false,
    };
  }
  return {
    commitmentYear: initial.commitmentYear ?? null,
    commitmentMonth: initial.commitmentMonth ?? null,
    commitmentDay: initial.commitmentDay ?? null,
    createdBy: initial.createdBy ?? null,
    adminSearch:
      initial.adminSearch != null && String(initial.adminSearch).trim() !== ""
        ? String(initial.adminSearch).trim().slice(0, 200)
        : null,
    tlFollowupOnly: Boolean(initial.tlFollowupOnly),
  };
}

function buildCommitmentYearOptions() {
  const y = new Date().getFullYear();
  const out = [];
  for (let k = 0; k <= 12; k += 1) out.push(y + 1 - k);
  return out;
}

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const adminTableSelectClass =
  "h-11 min-w-[9rem] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100";

function initialYearSelectFromAdmin(initialFilters) {
  const n = normalizeAdminFilterState(initialFilters);
  if (n.commitmentYear != null && Number.isFinite(Number(n.commitmentYear))) {
    return String(Number(n.commitmentYear));
  }
  return "all";
}

function initialMonthSelectFromAdmin(initialFilters) {
  const n = normalizeAdminFilterState(initialFilters);
  if (n.commitmentMonth != null && Number.isFinite(Number(n.commitmentMonth))) {
    return String(Number(n.commitmentMonth));
  }
  return "";
}

/** True when the user did a full browser reload (F5 / refresh), not client-side navigation. */
function isBrowserReload() {
  if (typeof window === "undefined") return false;
  const navEntry = performance.getEntriesByType("navigation")[0];
  if (navEntry && "type" in navEntry && navEntry.type === "reload") {
    return true;
  }
  try {
    const legacy = performance.navigation;
    if (legacy && legacy.type === legacy.TYPE_RELOAD) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function ProspectEmployeeViewModal({ employeeName, rows, onClose }) {
  if (!employeeName) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prospect-employee-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90vh,720px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div>
            <h2
              id="prospect-employee-modal-title"
              className="text-lg font-semibold text-slate-900"
            >
              Prospects — {employeeName}
            </h2>
            <p className="text-sm text-slate-500">
              {rows.length} record{rows.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-medium sm:px-4">Customer</th>
                <th className="px-3 py-2.5 font-medium sm:px-4">Quote</th>
                <th className="px-3 py-2.5 font-medium sm:px-4">Model</th>
                <th className="px-3 py-2.5 font-medium sm:px-4">Qty</th>
                <th className="px-3 py-2.5 font-medium sm:px-4">Amount</th>
                <th className="px-3 py-2.5 font-medium sm:px-4">Commitment</th>
                <th className="px-3 py-2.5 font-medium sm:px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="text-slate-800">
                  <td className="px-3 py-2.5 sm:px-4">
                    <div className="font-medium">{row.customer_id}</div>
                    {row.customer_name ? (
                      <div className="text-xs text-slate-500">{row.customer_name}</div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                    {row.quote_number || "—"}
                  </td>
                  <td className="max-w-[12rem] px-3 py-2.5 sm:max-w-xs sm:px-4">
                    <ModelCodesChips rowId={row.id} model={row.model} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">{row.qty}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                    {formatAmount(row.amount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                    {formatDate(row.commitment_date)}
                  </td>
                  <td className="px-3 py-2.5 sm:px-4">
                    {row.order_payment_target?.label ? (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.order_payment_target.cls}`}
                      >
                        {row.order_payment_target.label}
                      </span>
                    ) : (
                      String(row.status || "open")
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProspectEmployeeSummaryTable({
  rows,
  commitmentYearSelect,
  commitmentMonthSelect,
  onCommitmentYearChange,
  onCommitmentMonthChange,
  tlFollowupOnly,
  onTlFollowupChange,
}) {
  const [customerIdQuery, setCustomerIdQuery] = useState("");
  const [viewEmployee, setViewEmployee] = useState(null);

  const employeeRows = useMemo(
    () => aggregateProspectsByEmployee(rows),
    [rows],
  );

  const filteredEmployees = useMemo(() => {
    const q = customerIdQuery.trim();
    if (!q) return employeeRows;
    return employeeRows.filter((s) =>
      s.customerIds.some((id) => String(id).trim() === q),
    );
  }, [employeeRows, customerIdQuery]);

  const totals = useMemo(() => {
    let count = 0;
    let totalQty = 0;
    let totalAmount = 0;
    for (const e of filteredEmployees) {
      count += e.count;
      totalQty += e.totalQty;
      totalAmount += e.totalAmount;
    }
    return { count, totalQty, totalAmount };
  }, [filteredEmployees]);

  const modalRows = useMemo(() => {
    if (!viewEmployee) return [];
    const hit = employeeRows.find((e) => e.name === viewEmployee);
    return hit?.rows ?? [];
  }, [viewEmployee, employeeRows]);

  return (
    <>
      <div className="overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/90 px-3 py-4 sm:px-5">
          <div className="flex flex-wrap gap-3">
            <div className="inline-flex min-w-[7rem] rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Prospects
                </p>
                <p className="text-sm font-semibold tabular-nums text-slate-900">
                  {totals.count}
                </p>
              </div>
            </div>
            <div className="inline-flex min-w-[7rem] rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Qty
                </p>
                <p className="text-sm font-semibold tabular-nums text-slate-900">
                  {totals.totalQty}
                </p>
              </div>
            </div>
            <div className="inline-flex min-w-[7rem] rounded-lg border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/50 px-3 py-2 shadow-sm">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-700/90">
                  Value
                </p>
                <p className="text-sm font-semibold tabular-nums text-emerald-800">
                  {formatAmount(totals.totalAmount)}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 sm:min-w-[12rem]">
              <label htmlFor="employee-table-customer-id" className="sr-only">
                Search by customer ID
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  id="employee-table-customer-id"
                  type="search"
                  autoComplete="off"
                  value={customerIdQuery}
                  onChange={(e) => setCustomerIdQuery(e.target.value)}
                  placeholder="Filter by customer ID…"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm">
              <input
                type="checkbox"
                checked={tlFollowupOnly}
                onChange={(e) => onTlFollowupChange(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              TL follow-up clients only
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Year
              </span>
              <select
                className={adminTableSelectClass}
                value={commitmentYearSelect}
                onChange={onCommitmentYearChange}
                aria-label="Filter by commitment year"
              >
                <option value="all">All years</option>
                {buildCommitmentYearOptions().map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Month
              </span>
              <select
                className={adminTableSelectClass}
                value={commitmentMonthSelect}
                onChange={onCommitmentMonthChange}
                aria-label="Filter by commitment month"
              >
                <option value="">All months</option>
                {MONTH_LABELS.map((label, i) => (
                  <option key={label} value={String(i + 1)}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 font-medium sm:px-4">Employee name</th>
                <th className="px-3 py-3 font-medium sm:px-4">Amount</th>
                <th className="px-3 py-3 font-medium sm:px-4">Machine models (qty)</th>
                <th className="px-3 py-3 font-medium sm:px-4">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    No prospects for this period
                    {tlFollowupOnly ? " (TL follow-up filter on)" : ""}.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.name} className="text-slate-800">
                    <td className="px-3 py-3 font-medium sm:px-4">{emp.name}</td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums sm:px-4">
                      {formatAmount(emp.totalAmount)}
                    </td>
                    <td
                      className="max-w-md px-3 py-3 text-xs leading-relaxed text-slate-700 sm:max-w-xl sm:px-4 sm:text-sm"
                      title={emp.modelsText}
                    >
                      <span className="line-clamp-3">{emp.modelsText || "—"}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                      <button
                        type="button"
                        onClick={() => setViewEmployee(emp.name)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                      >
                        <Eye className="h-4 w-4" aria-hidden />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {viewEmployee ? (
        <ProspectEmployeeViewModal
          employeeName={viewEmployee}
          rows={modalRows}
          onClose={() => setViewEmployee(null)}
        />
      ) : null}
    </>
  );
}

export default function ProspectsListCard({
  initialRows = [],
  initialSearch = "",
  initialCustomerIds = [],
  initialQuoteNumbers = [],
  initialAdminFilters = null,
  loadError = null,
  viewerUsername = "",
  viewerIsAdmin = false,
  lockedCreatorName = null,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isMainProspectsList =
    pathname === "/admin-dashboard/prospects" ||
    pathname === "/admin-dashboard/prospects/";

  /** Admins see employee summary table on the main list; detail table on by-creator. */
  const hideDataTable =
    viewerIsAdmin && lockedCreatorName == null && isMainProspectsList;
  const [rows, setRows] = useState(initialRows);
  const [searchText, setSearchText] = useState(initialSearch);
  const [selectedCustomers, setSelectedCustomers] = useState(() =>
    buildSelectedFromIdsAndQuotes(initialCustomerIds, initialQuoteNumbers),
  );
  const [tableLoading, setTableLoading] = useState(false);

  const adminFiltersRef = useRef(
    normalizeAdminFilterState(initialAdminFilters),
  );

  const [commitmentYearSelect, setCommitmentYearSelect] = useState(() =>
    initialYearSelectFromAdmin(initialAdminFilters),
  );
  const [commitmentMonthSelect, setCommitmentMonthSelect] = useState(() =>
    initialMonthSelectFromAdmin(initialAdminFilters),
  );
  const [tlFollowupOnly, setTlFollowupOnly] = useState(
    () => normalizeAdminFilterState(initialAdminFilters).tlFollowupOnly,
  );

  const searchTextRef = useRef(searchText);
  searchTextRef.current = searchText;
  const selectedRef = useRef(selectedCustomers);
  selectedRef.current = selectedCustomers;

  /** On full page refresh, drop admin filter query params so UI resets to server defaults. */
  const reloadAdminFiltersStripDoneRef = useRef(false);

  const syncKey = `${initialCustomerIds.join("|")}__${initialQuoteNumbers.join("|")}__${initialSearch}`;
  const adminFilterKey = viewerIsAdmin
    ? JSON.stringify(initialAdminFilters ?? null)
    : "";

  useEffect(() => {
    setRows(initialRows);
    setSearchText(initialSearch);
    setSelectedCustomers(
      buildSelectedFromIdsAndQuotes(initialCustomerIds, initialQuoteNumbers),
    );
  }, [initialRows, syncKey, initialCustomerIds, initialQuoteNumbers, initialSearch]);

  useEffect(() => {
    if (!viewerIsAdmin) return;
    adminFiltersRef.current = normalizeAdminFilterState(initialAdminFilters);
    setCommitmentYearSelect(initialYearSelectFromAdmin(initialAdminFilters));
    setCommitmentMonthSelect(initialMonthSelectFromAdmin(initialAdminFilters));
    setTlFollowupOnly(
      normalizeAdminFilterState(initialAdminFilters).tlFollowupOnly,
    );
  }, [viewerIsAdmin, adminFilterKey, initialAdminFilters]);

  useEffect(() => {
    if (!viewerIsAdmin) return;
    if (reloadAdminFiltersStripDoneRef.current) return;
    if (!isBrowserReload()) {
      reloadAdminFiltersStripDoneRef.current = true;
      return;
    }

    const p = new URLSearchParams(searchParams.toString());
    const stripKeys = [
      "commitment_year",
      "commitment_month",
      "commitment_day",
      "admin_search",
      "created_by",
      "tl_followup",
    ];
    let changed = false;
    for (const k of stripKeys) {
      if (p.has(k)) {
        p.delete(k);
        changed = true;
      }
    }
    reloadAdminFiltersStripDoneRef.current = true;
    if (!changed) return;

    const base = lockedCreatorName
      ? `/admin-dashboard/prospects/by-creator/${encodeURIComponent(lockedCreatorName)}`
      : "/admin-dashboard/prospects";
    const qs = p.toString();
    router.replace(qs ? `${base}?${qs}` : base, { scroll: false });
  }, [viewerIsAdmin, searchParams, lockedCreatorName, router]);

  const syncAdminFiltersToUrl = useCallback(
    (snapshot) => {
      if (!viewerIsAdmin) return;
      const p = new URLSearchParams(searchParams.toString());
      const y = snapshot.commitmentYear;
      if (y != null && Number.isFinite(Number(y))) {
        p.set("commitment_year", String(Number(y)));
      } else {
        p.set("commitment_year", "all");
      }
      const m = snapshot.commitmentMonth;
      if (m != null && Number.isFinite(Number(m))) {
        p.set("commitment_month", String(Number(m)));
      } else {
        p.set("commitment_month", "all");
      }
      if (snapshot.commitmentDay != null) {
        p.set("commitment_day", String(snapshot.commitmentDay));
      } else {
        p.delete("commitment_day");
      }
      if (lockedCreatorName) {
        p.delete("created_by");
      } else if (snapshot.createdBy) {
        p.set("created_by", snapshot.createdBy);
      } else {
        p.delete("created_by");
      }
      if (snapshot.adminSearch) {
        p.set("admin_search", snapshot.adminSearch);
      } else {
        p.delete("admin_search");
      }
      if (snapshot.tlFollowupOnly) {
        p.set("tl_followup", "1");
      } else {
        p.delete("tl_followup");
      }
      const qs = p.toString();
      const base = lockedCreatorName
        ? `/admin-dashboard/prospects/by-creator/${encodeURIComponent(lockedCreatorName)}`
        : "/admin-dashboard/prospects";
      router.replace(qs ? `${base}?${qs}` : base, { scroll: false });
    },
    [viewerIsAdmin, searchParams, router, lockedCreatorName],
  );

  const refreshRows = useCallback(
    async (customerIds, text, quoteNums = [], adminSnapshot) => {
      setTableLoading(true);
      try {
        const adminF = viewerIsAdmin
          ? adminSnapshot ?? adminFiltersRef.current
          : null;
        const url = buildProspectsRowsApiUrl(customerIds, text, adminF);
        const res = await fetch(url);
        const data = await res.json();
        if (data.success && Array.isArray(data.rows)) {
          setRows(data.rows);
        }
      } catch {
        /* keep rows */
      } finally {
        setTableLoading(false);
      }
    },
    [viewerIsAdmin],
  );

  const onCommitmentYearChange = useCallback(
    (e) => {
      const v = e.target.value;
      setCommitmentYearSelect(v);
      const next = {
        ...adminFiltersRef.current,
        commitmentYear: v === "all" ? null : Number(v),
      };
      adminFiltersRef.current = next;
      syncAdminFiltersToUrl(next);
      const sel = selectedRef.current;
      void refreshRows(
        sel.map((c) => c.customer_id),
        "",
        sel.map((c) => c.quote_number ?? ""),
        next,
      );
    },
    [syncAdminFiltersToUrl, refreshRows],
  );

  const onCommitmentMonthChange = useCallback(
    (e) => {
      const v = e.target.value;
      setCommitmentMonthSelect(v);
      const next = {
        ...adminFiltersRef.current,
        commitmentMonth: v === "" ? null : Number(v),
      };
      adminFiltersRef.current = next;
      syncAdminFiltersToUrl(next);
      const sel = selectedRef.current;
      void refreshRows(
        sel.map((c) => c.customer_id),
        "",
        sel.map((c) => c.quote_number ?? ""),
        next,
      );
    },
    [syncAdminFiltersToUrl, refreshRows],
  );

  const onTlFollowupChange = useCallback(
    (checked) => {
      setTlFollowupOnly(checked);
      const next = {
        ...adminFiltersRef.current,
        tlFollowupOnly: checked,
      };
      adminFiltersRef.current = next;
      syncAdminFiltersToUrl(next);
      const sel = selectedRef.current;
      void refreshRows(
        sel.map((c) => c.customer_id),
        searchTextRef.current.trim(),
        sel.map((c) => c.quote_number ?? ""),
        next,
      );
    },
    [syncAdminFiltersToUrl, refreshRows],
  );

  const addSuggestion = useCallback((s) => {
    setSelectedCustomers((prev) => {
      const qn = s.quote_number ?? extractQuoteNumberFromProspectSearch(searchTextRef.current);
      if (
        prev.some(
          (p) =>
            p.customer_id === s.customer_id &&
            (p.quote_number || null) === (qn || null),
        )
      )
        return prev;
      // If the dropdown item doesn't contain quote_number, try to recover it
      // from the current search text (e.g. user typed QUOTE... and selected a customer).
      const quoteNumber = qn ?? undefined;
      const next = [
        ...prev,
        {
          customer_id: s.customer_id,
          subtitle: formatSuggestionSubtitle(s),
          quote_number: quoteNumber,
        },
      ];
      queueMicrotask(() =>
        refreshRows(
          next.map((x) => x.customer_id),
          "",
          next.map((x) => x.quote_number ?? ""),
        ),
      );
      return next;
    });
  }, [refreshRows]);

  const removeCustomer = useCallback(
    (customerId, quoteNumber) => {
      setSelectedCustomers((prev) => {
        const next =
          quoteNumber != null
            ? prev.filter(
                (p) =>
                  !(p.customer_id === customerId && p.quote_number === quoteNumber),
              )
            : prev.filter((p) => p.customer_id !== customerId);
        queueMicrotask(() =>
          refreshRows(
            next.map((x) => x.customer_id),
            "",
            next.map((x) => x.quote_number ?? ""),
          ),
        );
        return next;
      });
    },
    [refreshRows],
  );

  const submitSearch = useCallback(() => {
    const sel = selectedRef.current;
    if (sel.length === 0) return;
    void refreshRows(
      sel.map((c) => c.customer_id),
      "",
      sel.map((c) => c.quote_number ?? ""),
    );
  }, [refreshRows]);

  const navigateToAddFromSuggestion = useCallback(
    (s) => {
      const qn =
        s.quote_number ??
        extractQuoteNumberFromProspectSearch(searchTextRef.current);
      const q = encodeURIComponent(String(s.customer_id));
      let quoteQs = "";
      if (qn) {
        quoteQs = `&quote_number=${encodeURIComponent(String(qn))}`;
      } else {
        const fromSearch = extractQuoteNumberFromProspectSearch(
          searchTextRef.current,
        );
        if (fromSearch) {
          quoteQs = `&quote_number=${encodeURIComponent(fromSearch)}`;
        }
      }
      router.push(`/admin-dashboard/prospects/new?customers=${q}${quoteQs}`);
    },
    [router],
  );

  // Delete disabled for all roles (admin + sales).
  // const handleDelete = useCallback(
  //   (rowId) => {
  //     if (!confirm("Delete this prospect? This cannot be undone.")) return;
  //     startTransition(async () => {
  //       const res = await deleteProspect(rowId);
  //       if (!res?.ok) {
  //         window.alert(res?.error || "Could not delete.");
  //         return;
  //       }
  //       const sel = selectedRef.current;
  //       await refreshRows(
  //         sel.map((c) => c.customer_id),
  //         searchTextRef.current.trim(),
  //         sel.map((c) => c.quote_number ?? ""),
  //       );
  //       router.refresh();
  //     });
  //   },
  //   [refreshRows, router],
  // );

  const hasAdminUiFilter = useMemo(() => {
    if (!viewerIsAdmin) return false;
    const norm = normalizeAdminFilterState(initialAdminFilters);
    if (norm.commitmentYear != null) return true;
    if (norm.commitmentMonth != null) return true;
    if (norm.commitmentDay != null) return true;
    if (norm.adminSearch && String(norm.adminSearch).trim() !== "") return true;
    if (!lockedCreatorName && norm.createdBy) return true;
    if (norm.tlFollowupOnly) return true;
    return false;
  }, [viewerIsAdmin, adminFilterKey, initialAdminFilters, lockedCreatorName]);

  const tableTotalAmount = useMemo(() => {
    let sum = 0;
    for (const row of rows) {
      const n = Number(row.amount);
      if (Number.isFinite(n)) sum += n;
    }
    return sum;
  }, [rows]);

  if (loadError) {
    return (
      <>
        <ProspectsSearchBar
          searchText={searchText}
          onSearchTextChange={setSearchText}
          selectedCustomers={[]}
          onAddSuggestion={() => {}}
          onRemoveCustomer={() => {}}
          onSubmitSearch={() => {}}
          onSuggestionNavigateToAdd={() => {}}
        />
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link
            href="/admin-dashboard/prospects/add-manual"
            className="inline-flex items-center justify-center rounded-[10px] bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            Add prospect (manual)
          </Link>
        </div>
        <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          {loadError}
        </div>
      </>
    );
  }

  const hasFilter =
    selectedCustomers.length > 0 || hasAdminUiFilter;

  const tableHeaders = [
    "Customer_id",
    "Customer name",
    "Quotation",
    "Model",
    "Qty",
    "Total amount",
    "Commitment_date",
    "Notes",
    "Status",
    ...(viewerIsAdmin ? ["Created by"] : []),
    "Actions",
  ];
  const tableColSpan = tableHeaders.length;

  return (
    <>
      <ProspectsSearchBar
        searchText={searchText}
        onSearchTextChange={setSearchText}
        selectedCustomers={selectedCustomers}
        onAddSuggestion={addSuggestion}
        onRemoveCustomer={removeCustomer}
        onSubmitSearch={submitSearch}
        onSuggestionNavigateToAdd={navigateToAddFromSuggestion}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/admin-dashboard/prospects/add-manual"
          className="inline-flex items-center justify-center rounded-[10px] bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          Add prospect (manual)
        </Link>
        <span className="text-xs text-slate-500">
          No quotation required
        </span>
      </div>

      {viewerIsAdmin && !hideDataTable ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/90 p-3 sm:p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div
              className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
              title="Sum of Total amount for rows currently shown in the table"
            >
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Total amount
                </p>
                <p className="text-sm font-semibold tabular-nums text-slate-900">
                  {formatAmount(tableTotalAmount)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2 sm:ml-auto">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Year
                </span>
                <select
                  className={adminTableSelectClass}
                  value={commitmentYearSelect}
                  onChange={onCommitmentYearChange}
                  aria-label="Filter by commitment year"
                >
                  <option value="all">All years</option>
                  {buildCommitmentYearOptions().map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Month
                </span>
                <select
                  className={adminTableSelectClass}
                  value={commitmentMonthSelect}
                  onChange={onCommitmentMonthChange}
                  aria-label="Filter by commitment month"
                >
                  <option value="">All months</option>
                  {MONTH_LABELS.map((label, i) => (
                    <option key={label} value={String(i + 1)}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {!hideDataTable ? (
      <div className="relative overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-sm">
        {tableLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 text-sm text-slate-500">
            Loading…
          </div>
        ) : null}
        <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <table className="min-w-[58rem] w-full divide-y divide-slate-200 text-sm sm:min-w-[62rem]">
            <thead className="bg-slate-50">
              <tr>
                {tableHeaders.map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="whitespace-nowrap px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:px-4 sm:py-3 sm:text-xs"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableColSpan}
                    className="px-3 py-10 text-center text-sm text-slate-500 sm:px-4 sm:py-12"
                  >
                    {hasFilter
                      ? "No prospects match this filter."
                      : "No prospects yet. Use Add Prospects above."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const canMutate = canDeleteProspectRow(
                    row,
                    viewerIsAdmin,
                    viewerUsername,
                  );
                  const isFinalized = Boolean(row.finalized_at);
                  const canEdit = canMutate && !isFinalized;
                  const canViewSubmitted = canMutate && isFinalized;
                  return (
                  <tr
                    key={row.id}
                    className="bg-white hover:bg-slate-50/80"
                  >
                    <td className="whitespace-nowrap px-2 py-2.5 font-medium text-slate-900 sm:px-4 sm:py-3">
                      {row.customer_id}
                    </td>
                    <td
                      className="max-w-[10rem] px-2 py-2.5 text-slate-800 sm:max-w-[14rem] sm:px-4 sm:py-3"
                      title={
                        row.customer_name
                          ? String(row.customer_name)
                          : undefined
                      }
                    >
                      {row.customer_name ? (
                        <span className="line-clamp-2 text-sm">
                          {row.customer_name}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="max-w-[9rem] whitespace-nowrap px-2 py-2.5 font-mono text-xs text-slate-700 sm:max-w-none sm:px-4 sm:py-3 sm:text-sm">
                      {row.quote_number || "—"}
                    </td>
                    <td
                      className="min-w-[10rem] max-w-xl px-2 py-2.5 align-top text-slate-800 sm:min-w-[14rem] sm:px-4 sm:py-3"
                      title={row.model ? String(row.model) : undefined}
                    >
                      <ModelCodesChips rowId={row.id} model={row.model} />
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-slate-800 sm:px-4 sm:py-3">
                      {row.qty}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-xs text-slate-800 sm:px-4 sm:py-3 sm:text-sm">
                      {formatAmount(row.amount)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-xs text-slate-800 sm:px-4 sm:py-3 sm:text-sm">
                      {formatDate(row.commitment_date)}
                    </td>
                    <td
                      className="min-w-[8rem] max-w-md px-2 py-2.5 text-slate-700 sm:min-w-[10rem] sm:px-4 sm:py-3"
                      title={row.notes ? String(row.notes) : undefined}
                    >
                      {formatNotesPreview(row.notes, 48)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 sm:px-4 sm:py-3">
                      {row.order_payment_target?.label ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${row.order_payment_target.cls}`}
                          title="Uses linked Order ID when set; else matches order total to this row. Paid by commitment → achieved; paid after → not-achieved; else pending."
                        >
                          {row.order_payment_target.label}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {viewerIsAdmin ? (
                      <td
                        className="max-w-[6rem] truncate px-2 py-2.5 text-slate-600 sm:max-w-[10rem] sm:px-4 sm:py-3"
                        title={
                          row.created_by
                            ? String(row.created_by)
                            : undefined
                        }
                      >
                        {row.created_by ? (
                          <span className="font-medium text-slate-800">
                            {String(row.created_by)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    ) : null}
                    <td className="whitespace-nowrap px-2 py-2.5 sm:px-4 sm:py-3">
                      <div className="flex items-center gap-1 sm:gap-1.5">
                        {canEdit ? (
                          <Link
                            href={`/admin-dashboard/prospects/${row.id}/edit`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                            title="Edit & final submit"
                            aria-label="Edit prospect"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                        ) : canViewSubmitted ? (
                          <Link
                            href={`/admin-dashboard/prospects/${row.id}/edit`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                            title="View prospect"
                            aria-label="View prospect"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        ) : null}
                        {/* Delete hidden for admin + user — restore with handleDelete + deleteProspect if needed.
                        {canMutate ? (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleDelete(row.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50 hover:text-red-800 disabled:opacity-50"
                            title="Delete prospect"
                            aria-label="Delete prospect"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                        */}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      ) : (
        <div className="relative">
          {tableLoading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[10px] bg-white/60 text-sm text-slate-500">
              Updating…
            </div>
          ) : null}
          <ProspectEmployeeSummaryTable
            rows={rows}
            commitmentYearSelect={commitmentYearSelect}
            commitmentMonthSelect={commitmentMonthSelect}
            onCommitmentYearChange={onCommitmentYearChange}
            onCommitmentMonthChange={onCommitmentMonthChange}
            tlFollowupOnly={tlFollowupOnly}
            onTlFollowupChange={onTlFollowupChange}
          />
        </div>
      )}
    </>
  );
}
