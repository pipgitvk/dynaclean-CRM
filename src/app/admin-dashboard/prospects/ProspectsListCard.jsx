"use client";

import { useEffect, useState, useCallback, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, Pencil, Search, Trash2 } from "lucide-react";
import ProspectsSearchBar from "./ProspectsSearchBar";
import { deleteProspect } from "./actions";
import {
  buildProspectsRowsApiUrl,
  extractQuoteNumberFromProspectSearch,
} from "@/lib/prospectFilterUtils";

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
  };
}

function adminSnapshotToSelectStrings(f) {
  return {
    year: f.commitmentYear != null ? String(f.commitmentYear) : "",
    month: f.commitmentMonth != null ? String(f.commitmentMonth) : "",
    day: f.commitmentDay != null ? String(f.commitmentDay) : "",
    createdBy: f.createdBy ?? "",
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

const adminSelectClass =
  "h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90";

export default function ProspectsListCard({
  initialRows = [],
  initialSearch = "",
  initialCustomerIds = [],
  initialQuoteNumbers = [],
  initialAdminFilters = null,
  prospectCreatorUsernames = [],
  loadError = null,
  viewerUsername = "",
  viewerIsAdmin = false,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState(initialRows);
  const [searchText, setSearchText] = useState(initialSearch);
  const [selectedCustomers, setSelectedCustomers] = useState(() =>
    buildSelectedFromIdsAndQuotes(initialCustomerIds, initialQuoteNumbers),
  );
  const [tableLoading, setTableLoading] = useState(false);

  const emptyAdminSnapshot = useRef({
    commitmentYear: null,
    commitmentMonth: null,
    commitmentDay: null,
    createdBy: null,
    adminSearch: null,
  });
  const adminFiltersRef = useRef(
    normalizeAdminFilterState(initialAdminFilters),
  );
  const adminSearchDebounceRef = useRef(null);

  const [fYear, setFYear] = useState(() =>
    adminSnapshotToSelectStrings(normalizeAdminFilterState(initialAdminFilters))
      .year,
  );
  const [fMonth, setFMonth] = useState(() =>
    adminSnapshotToSelectStrings(normalizeAdminFilterState(initialAdminFilters))
      .month,
  );
  const [fDay, setFDay] = useState(() =>
    adminSnapshotToSelectStrings(normalizeAdminFilterState(initialAdminFilters))
      .day,
  );
  const [fCreatedBy, setFCreatedBy] = useState(() =>
    adminSnapshotToSelectStrings(normalizeAdminFilterState(initialAdminFilters))
      .createdBy,
  );
  const [fAdminSearch, setFAdminSearch] = useState(() => {
    const n = normalizeAdminFilterState(initialAdminFilters);
    return n.adminSearch ?? "";
  });

  const searchTextRef = useRef(searchText);
  searchTextRef.current = searchText;
  const selectedRef = useRef(selectedCustomers);
  selectedRef.current = selectedCustomers;

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
    const norm = normalizeAdminFilterState(initialAdminFilters);
    adminFiltersRef.current = norm;
    const s = adminSnapshotToSelectStrings(norm);
    setFYear(s.year);
    setFMonth(s.month);
    setFDay(s.day);
    setFCreatedBy(s.createdBy);
    setFAdminSearch(norm.adminSearch ?? "");
  }, [viewerIsAdmin, adminFilterKey, initialAdminFilters]);

  useEffect(() => {
    return () => {
      if (adminSearchDebounceRef.current) {
        clearTimeout(adminSearchDebounceRef.current);
      }
    };
  }, []);

  const syncAdminFiltersToUrl = useCallback(
    (snapshot) => {
      if (!viewerIsAdmin) return;
      const p = new URLSearchParams(searchParams.toString());
      if (snapshot.commitmentYear != null) {
        p.set("commitment_year", String(snapshot.commitmentYear));
      } else {
        p.delete("commitment_year");
      }
      if (snapshot.commitmentMonth != null) {
        p.set("commitment_month", String(snapshot.commitmentMonth));
      } else {
        p.delete("commitment_month");
      }
      if (snapshot.commitmentDay != null) {
        p.set("commitment_day", String(snapshot.commitmentDay));
      } else {
        p.delete("commitment_day");
      }
      if (snapshot.createdBy) {
        p.set("created_by", snapshot.createdBy);
      } else {
        p.delete("created_by");
      }
      if (snapshot.adminSearch) {
        p.set("admin_search", snapshot.adminSearch);
      } else {
        p.delete("admin_search");
      }
      const qs = p.toString();
      router.replace(
        qs ? `/admin-dashboard/prospects?${qs}` : "/admin-dashboard/prospects",
        { scroll: false },
      );
    },
    [viewerIsAdmin, searchParams, router],
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

  const applyAdminFilterSnapshot = useCallback(
    (next) => {
      adminFiltersRef.current = next;
      const sel = selectedRef.current;
      void refreshRows(
        sel.map((c) => c.customer_id),
        searchTextRef.current,
        sel.map((c) => c.quote_number ?? ""),
        next,
      );
      syncAdminFiltersToUrl(next);
    },
    [refreshRows, syncAdminFiltersToUrl],
  );

  const flushAdminSearchNow = useCallback(
    (raw) => {
      const trimmed = String(raw ?? "").trim().slice(0, 200);
      const next = {
        ...adminFiltersRef.current,
        adminSearch: trimmed || null,
      };
      applyAdminFilterSnapshot(next);
    },
    [applyAdminFilterSnapshot],
  );

  const clearAdminFilters = useCallback(() => {
    if (adminSearchDebounceRef.current) {
      clearTimeout(adminSearchDebounceRef.current);
      adminSearchDebounceRef.current = null;
    }
    const next = { ...emptyAdminSnapshot.current };
    adminFiltersRef.current = next;
    setFYear("");
    setFMonth("");
    setFDay("");
    setFCreatedBy("");
    setFAdminSearch("");
    const sel = selectedRef.current;
    void refreshRows(
      sel.map((c) => c.customer_id),
      searchTextRef.current,
      sel.map((c) => c.quote_number ?? ""),
      next,
    );
    syncAdminFiltersToUrl(next);
  }, [refreshRows, syncAdminFiltersToUrl]);

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
          searchTextRef.current,
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
            searchTextRef.current,
            next.map((x) => x.quote_number ?? ""),
          ),
        );
        return next;
      });
    },
    [refreshRows],
  );

  const submitSearch = useCallback(() => {
    const text = searchTextRef.current.trim();
    const sel = selectedRef.current;
    void refreshRows(
      sel.map((c) => c.customer_id),
      text,
      sel.map((c) => c.quote_number ?? ""),
    );
  }, [refreshRows]);

  const goAddProspects = useCallback(() => {
    const sel = selectedRef.current;
    if (sel.length === 0) {
      window.alert(
        "Please add client_id: select a customer from the search bar first.",
      );
      return;
    }
    const customerIds = sel.map((c) => c.customer_id);
    const quoteNums = sel
      .map((c) => c.quote_number)
      .filter(Boolean)
      .map(String);
    const fromSearch = extractQuoteNumberFromProspectSearch(
      searchTextRef.current,
    );
    const q = encodeURIComponent(customerIds.join(","));
    let quoteQs = "";
    if (quoteNums.length === customerIds.length) {
      quoteQs = `&quote_numbers=${encodeURIComponent(quoteNums.join(","))}`;
    } else if (quoteNums.length === 1) {
      quoteQs = `&quote_number=${encodeURIComponent(quoteNums[0])}`;
    } else if (fromSearch) {
      quoteQs = `&quote_number=${encodeURIComponent(fromSearch)}`;
    }
    router.push(`/admin-dashboard/prospects/new?customers=${q}${quoteQs}`);
  }, [router]);

  const handleDelete = useCallback(
    (rowId) => {
      if (!confirm("Delete this prospect? This cannot be undone.")) return;
      startTransition(async () => {
        const res = await deleteProspect(rowId);
        if (!res?.ok) {
          window.alert(res?.error || "Could not delete.");
          return;
        }
        const sel = selectedRef.current;
        await refreshRows(
          sel.map((c) => c.customer_id),
          searchTextRef.current.trim(),
          sel.map((c) => c.quote_number ?? ""),
        );
        router.refresh();
      });
    },
    [refreshRows, router],
  );

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
          onAddProspects={() => {}}
        />
        <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          {loadError}
        </div>
      </>
    );
  }

  const hasAdminUiFilter =
    viewerIsAdmin &&
    (fYear !== "" ||
      fMonth !== "" ||
      fDay !== "" ||
      fCreatedBy !== "" ||
      fAdminSearch.trim() !== "");
  const hasFilter =
    selectedCustomers.length > 0 ||
    searchText.trim().length > 0 ||
    hasAdminUiFilter;

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
        onAddProspects={goAddProspects}
      />

      {viewerIsAdmin ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/90 p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Admin filters
            </p>
            <button
              type="button"
              onClick={clearAdminFilters}
              className="text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
            >
              Clear filters
            </button>
          </div>
          <div className="mb-4 min-w-0">
            <label
              htmlFor="prospect-admin-search"
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              Search by customer name, quotation ID, or customer ID
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
                strokeWidth={1.75}
                aria-hidden
              />
              <input
                id="prospect-admin-search"
                type="search"
                value={fAdminSearch}
                placeholder="e.g. rahul yadav, QUOTE20260320013, 721091"
                autoComplete="off"
                className="h-11 w-full rounded-[10px] border border-slate-200 bg-white py-3 pl-11 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90"
                onChange={(e) => {
                  const v = e.target.value.slice(0, 200);
                  setFAdminSearch(v);
                  if (adminSearchDebounceRef.current) {
                    clearTimeout(adminSearchDebounceRef.current);
                  }
                  adminSearchDebounceRef.current = setTimeout(() => {
                    adminSearchDebounceRef.current = null;
                    const trimmed = v.trim().slice(0, 200);
                    const next = {
                      ...adminFiltersRef.current,
                      adminSearch: trimmed || null,
                    };
                    applyAdminFilterSnapshot(next);
                  }, 400);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  if (adminSearchDebounceRef.current) {
                    clearTimeout(adminSearchDebounceRef.current);
                    adminSearchDebounceRef.current = null;
                  }
                  flushAdminSearchNow(e.currentTarget.value);
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:flex lg:flex-wrap lg:items-end">
            <div className="min-w-0 lg:min-w-[7.5rem] lg:flex-1">
              <label
                htmlFor="prospect-filter-year"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                Year
              </label>
              <select
                id="prospect-filter-year"
                value={fYear}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = {
                    ...adminFiltersRef.current,
                    commitmentYear: v === "" ? null : Number(v),
                  };
                  adminFiltersRef.current = next;
                  setFYear(v);
                  applyAdminFilterSnapshot(next);
                }}
                className={adminSelectClass}
              >
                <option value="">All years</option>
                {buildCommitmentYearOptions().map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 lg:min-w-[8.5rem] lg:flex-1">
              <label
                htmlFor="prospect-filter-month"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                Month
              </label>
              <select
                id="prospect-filter-month"
                value={fMonth}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = {
                    ...adminFiltersRef.current,
                    commitmentMonth: v === "" ? null : Number(v),
                  };
                  adminFiltersRef.current = next;
                  setFMonth(v);
                  applyAdminFilterSnapshot(next);
                }}
                className={adminSelectClass}
              >
                <option value="">All months</option>
                {MONTH_LABELS.map((label, idx) => (
                  <option key={label} value={String(idx + 1)}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 lg:min-w-[6.5rem] lg:flex-1">
              <label
                htmlFor="prospect-filter-day"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                Day
              </label>
              <select
                id="prospect-filter-day"
                value={fDay}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = {
                    ...adminFiltersRef.current,
                    commitmentDay: v === "" ? null : Number(v),
                  };
                  adminFiltersRef.current = next;
                  setFDay(v);
                  applyAdminFilterSnapshot(next);
                }}
                className={adminSelectClass}
              >
                <option value="">All days</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={String(d)}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 min-w-0 md:col-span-2 lg:min-w-[12rem] lg:flex-[1.25]">
              <label
                htmlFor="prospect-filter-created-by"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                Employee (created by)
              </label>
              <select
                id="prospect-filter-created-by"
                value={fCreatedBy}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = {
                    ...adminFiltersRef.current,
                    createdBy: v === "" ? null : v,
                  };
                  adminFiltersRef.current = next;
                  setFCreatedBy(v);
                  applyAdminFilterSnapshot(next);
                }}
                className={adminSelectClass}
              >
                <option value="">All employees</option>
                {prospectCreatorUsernames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}

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
    </>
  );
}
