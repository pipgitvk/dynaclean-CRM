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
import { ChevronRight, Eye, Pencil, Search, User } from "lucide-react";
import ProspectsSearchBar from "./ProspectsSearchBar";
// import { deleteProspect } from "./actions";
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

function buildByCreatorHref(name, sp) {
  const base = `/admin-dashboard/prospects/by-creator/${encodeURIComponent(name)}`;
  const q = new URLSearchParams();
  const cy = sp.get("commitment_year");
  const cm = sp.get("commitment_month");
  const cd = sp.get("commitment_day");
  if (cy) q.set("commitment_year", cy);
  if (cm) q.set("commitment_month", cm);
  if (cd) q.set("commitment_day", cd);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
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

function ProspectCreatorCardsGrid({
  summaries,
  selectedCreatorFromPath,
  commitmentYearSelect,
  commitmentMonthSelect,
  onCommitmentYearChange,
  onCommitmentMonthChange,
}) {
  const sp = useSearchParams();
  const [customerIdQuery, setCustomerIdQuery] = useState("");

  const filteredSummaries = useMemo(() => {
    const q = customerIdQuery.trim();
    if (!q) return summaries;
    return summaries.filter((s) => {
      const ids = Array.isArray(s.customerIds) ? s.customerIds : [];
      return ids.some((id) => String(id).trim() === q);
    });
  }, [summaries, customerIdQuery]);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-white p-5 shadow-sm sm:p-6 md:p-8">
      <div className="mb-5 border-b border-slate-200/80 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">
              Created by
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose a team member to open their prospects
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 sm:min-w-[12rem]">
            <label htmlFor="creator-cards-customer-id-search" className="sr-only">
              Search by customer ID
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                id="creator-cards-customer-id-search"
                type="search"
                autoComplete="off"
                value={customerIdQuery}
                onChange={(e) => setCustomerIdQuery(e.target.value)}
                placeholder="Search by customer ID…"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Year
            </span>
            <select
              className={adminTableSelectClass}
              value={commitmentYearSelect}
              onChange={onCommitmentYearChange}
              aria-label="Filter creator cards by commitment year"
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
              aria-label="Filter creator cards by commitment month"
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
      {!summaries.length ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-600">
            No creator cards for this period. Try another year or month, or add
            prospects.
          </p>
        </div>
      ) : filteredSummaries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-600">
            No creator matches this customer ID.
          </p>
        </div>
      ) : (
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredSummaries.map(({ name, count, totalAmount = 0 }) => {
          const selected = selectedCreatorFromPath === name;
          const amount = Number(totalAmount ?? 0);
          return (
            <li key={name}>
              <Link
                href={buildByCreatorHref(name, sp)}
                scroll={false}
                className={[
                  "group relative flex flex-col gap-3 rounded-2xl border p-5 text-left transition-all duration-200",
                  "outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                  selected
                    ? "border-blue-400 bg-gradient-to-br from-blue-50/50 to-white shadow-md ring-2 ring-blue-500/30"
                    : "border-slate-200/90 bg-gradient-to-br from-white via-slate-50/40 to-blue-50/50 shadow-sm hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={[
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white",
                      selected ? "bg-blue-600 text-white" : "",
                    ].join(" ")}
                  >
                    <User className="h-5 w-5" strokeWidth={2} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span
                      className="line-clamp-2 text-base font-semibold leading-snug text-slate-900"
                      title={name}
                    >
                      {name}
                    </span>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                      {count} {count === 1 ? "prospect" : "prospects"}
                    </p>
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Total amount
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-emerald-700">
                      {formatAmount(amount)}
                    </p>
                  </div>
                  <ChevronRight
                    className={[
                      "h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500",
                      selected ? "text-blue-500" : "",
                    ].join(" ")}
                    aria-hidden
                  />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      )}
    </div>
  );
}

export default function ProspectsListCard({
  initialRows = [],
  initialSearch = "",
  initialCustomerIds = [],
  initialQuoteNumbers = [],
  initialAdminFilters = null,
  prospectCreatorSummaries = [],
  loadError = null,
  viewerUsername = "",
  viewerIsAdmin = false,
  lockedCreatorName = null,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedCreatorFromPath = useMemo(() => {
    const mark = "/admin-dashboard/prospects/by-creator/";
    if (!pathname.startsWith(mark)) return null;
    return decodeURIComponent(pathname.slice(mark.length));
  }, [pathname]);

  const isMainProspectsList =
    pathname === "/admin-dashboard/prospects" ||
    pathname === "/admin-dashboard/prospects/";

  /** Admins use creator cards → by-creator page; hide the big table on the main list only. */
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

  const allCreatorsCardsTotalAmount = useMemo(() => {
    let sum = 0;
    for (const s of prospectCreatorSummaries) {
      const n = Number(s.totalAmount);
      if (Number.isFinite(n)) sum += n;
    }
    return sum;
  }, [prospectCreatorSummaries]);

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

      {viewerIsAdmin ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/90 p-3 sm:p-4">
          {!hideDataTable ? (
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
          ) : (
            <div
              className="inline-flex rounded-lg border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/50 px-3 py-2 shadow-sm"
              title="Sum of total amount across all creator cards below"
            >
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-700/90">
                  All creators total
                </p>
                <p className="text-sm font-semibold tabular-nums text-emerald-800">
                  {formatAmount(allCreatorsCardsTotalAmount)}
                </p>
              </div>
            </div>
          )}
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
        <ProspectCreatorCardsGrid
          summaries={prospectCreatorSummaries}
          selectedCreatorFromPath={selectedCreatorFromPath}
          commitmentYearSelect={commitmentYearSelect}
          commitmentMonthSelect={commitmentMonthSelect}
          onCommitmentYearChange={onCommitmentYearChange}
          onCommitmentMonthChange={onCommitmentMonthChange}
        />
      )}
    </>
  );
}
