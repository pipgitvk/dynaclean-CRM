"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

function formatDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "numeric",
    year: "numeric",
  });
}

function formatTotal(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

export default function ProspectsSearchBar({
  searchText,
  onSearchTextChange,
  selectedCustomers = [],
  onAddSuggestion,
  onRemoveCustomer,
  onSubmitSearch,
}) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef(null);
  const debounceRef = useRef(null);

  const fetchSuggestions = useCallback((q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = q.trim();
    if (trimmed.length < 1) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/prospects/customer-suggestions?q=${encodeURIComponent(trimmed)}`,
        );
        const data = await res.json();
        if (data.success && Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
          setOpen(data.suggestions.length > 0);
          setHighlight(-1);
        } else {
          setSuggestions([]);
          setOpen(false);
        }
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 220);
  }, []);

  useEffect(() => {
    fetchSuggestions(searchText);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchText, fetchSuggestions]);

  useEffect(() => {
    function handlePointerDown(e) {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const selectedKeys = new Set(
    selectedCustomers.map((c) =>
      c.quote_number ? `${c.customer_id}:${c.quote_number}` : c.customer_id,
    ),
  );

  function pickSuggestion(s) {
    const key = s.quote_number
      ? `${s.customer_id}:${s.quote_number}`
      : s.customer_id;
    if (selectedKeys.has(key)) return;
    onAddSuggestion?.(s);
    setHighlight(-1);
  }

  function onKeyDown(e) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === "Enter" && highlight >= 0 && suggestions[highlight]) {
      e.preventDefault();
      const s = suggestions[highlight];
      const key = s.quote_number
        ? `${s.customer_id}:${s.quote_number}`
        : s.customer_id;
      if (!selectedKeys.has(key)) pickSuggestion(s);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    if (typeof onSubmitSearch === "function") {
      onSubmitSearch();
      return;
    }
    const params = new URLSearchParams();
    const ids = selectedCustomers.map((c) => c.customer_id).join(",");
    if (ids) params.set("customers", ids);
    const s = String(searchText ?? "").trim();
    if (s) params.set("search", s);
    const q = params.toString();
    router.push(q ? `/admin-dashboard/prospects?${q}` : "/admin-dashboard/prospects");
  }

  return (
    <form
      onSubmit={handleFormSubmit}
      className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start"
    >
      <div ref={rootRef} className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-3.5 top-[13px] z-[1] h-[18px] w-[18px] text-slate-400"
          strokeWidth={1.75}
          aria-hidden
        />
        <input
          type="search"
          value={searchText}
          onChange={(e) => {
            onSearchTextChange?.(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search by quotation number (e.g. QUOTE20260320011) — add multiple"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          className="h-11 w-full rounded-[10px] border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-none outline-none ring-0 placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90"
        />
        {loading ? (
          <span className="pointer-events-none absolute right-3 top-[13px] text-xs text-slate-400">
            …
          </span>
        ) : null}
        {open && suggestions.length > 0 ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-auto rounded-[10px] border border-slate-200 bg-white shadow-lg">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Quotation ID
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Client Name
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Email
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Phone
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Date
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s, i) => {
                  const key = s.quote_number
                    ? `${s.customer_id}:${s.quote_number}`
                    : s.customer_id;
                  const taken = selectedKeys.has(key);
                  return (
                    <tr
                      key={key}
                      role="option"
                      aria-selected={i === highlight}
                      className={`cursor-pointer border-t border-slate-100 ${
                        taken
                          ? "bg-slate-50 text-slate-400"
                          : i === highlight
                            ? "bg-slate-100"
                            : "hover:bg-slate-50"
                      } ${taken ? "cursor-not-allowed" : ""}`}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => !taken && pickSuggestion(s)}
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {s.quote_number || "—"}
                        {taken ? (
                          <span className="ml-1.5 text-xs font-normal text-emerald-600">
                            (added)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {s.client_name || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {s.email || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {s.phone || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {formatDate(s.quote_date)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {formatTotal(s.grand_total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {selectedCustomers.length > 0 ? (
          <div className="mt-3 rounded-[10px] border border-slate-200 bg-slate-50/80 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {selectedCustomers.some((c) => c.quote_number)
                ? `Selected quotations (${selectedCustomers.length})`
                : `Selected (${selectedCustomers.length})`}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedCustomers.map((c) => {
                const key = c.quote_number
                  ? `${c.customer_id}:${c.quote_number}`
                  : c.customer_id;
                const primaryLabel = c.quote_number
                  ? c.quote_number
                  : `Customer ${c.customer_id}`;
                return (
                  <span
                    key={key}
                    className="inline-flex max-w-full items-center gap-1 rounded-lg border border-slate-200 bg-white py-1 pl-2.5 pr-1 text-xs text-slate-800 shadow-sm"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-semibold">{primaryLabel}</span>
                      {c.subtitle ? (
                        <span className="text-slate-500"> — {c.subtitle}</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onRemoveCustomer?.(c.customer_id, c.quote_number)
                      }
                      className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      aria-label={`Remove ${c.quote_number || c.customer_id}`}
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
      <button
        type="submit"
        className="h-11 shrink-0 rounded-[10px] border border-slate-200 bg-white px-5 text-sm font-medium text-slate-600 shadow-none transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200/90 sm:mt-0"
      >
        Search
      </button>
    </form>
  );
}
