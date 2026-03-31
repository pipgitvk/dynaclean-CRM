"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  /** Plain click / Enter on a suggestion row opens Add Prospect; Ctrl+click still adds to selection only. */
  onSuggestionNavigateToAdd,
}) {
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

  function handleSuggestionRowClick(e, s) {
    if (e.ctrlKey || e.metaKey) {
      const key = s.quote_number
        ? `${s.customer_id}:${s.quote_number}`
        : s.customer_id;
      if (!selectedKeys.has(key)) pickSuggestion(s);
      return;
    }
    onSuggestionNavigateToAdd?.(s);
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
      if (e.ctrlKey || e.metaKey) {
        const key = s.quote_number
          ? `${s.customer_id}:${s.quote_number}`
          : s.customer_id;
        if (!selectedKeys.has(key)) pickSuggestion(s);
      } else {
        onSuggestionNavigateToAdd?.(s);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    onSubmitSearch?.();
  }

  return (
    <form
      onSubmit={handleFormSubmit}
      className="mb-4 flex flex-col gap-4"
    >
      <div ref={rootRef} className="min-w-0 space-y-2">
        <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
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
              placeholder="Quotation ID, customer ID (e.g. QUOTE…, 721091) — click a result to add prospect; Ctrl+click to add to list only"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={open}
              className="h-11 w-full rounded-[10px] border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-none outline-none ring-0 placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90"
            />
            {loading ? (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                …
              </span>
            ) : null}
        </div>
        {open && suggestions.length > 0 ? (
          <div
            className="max-h-[min(22rem,50vh)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md ring-1 ring-slate-900/5"
            role="listbox"
          >
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="sticky top-0 z-[1] bg-slate-50 shadow-sm">
                  <tr>
                    <th className="whitespace-nowrap px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:text-xs">
                      Quotation ID
                    </th>
                    <th className="whitespace-nowrap px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:text-xs">
                      Client
                    </th>
                    <th className="hidden px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:table-cell sm:px-3 sm:text-xs">
                      Email
                    </th>
                    <th className="whitespace-nowrap px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:text-xs">
                      Phone
                    </th>
                    <th className="whitespace-nowrap px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:text-xs">
                      Date
                    </th>
                    <th className="whitespace-nowrap px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:text-xs">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
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
                          title="Click to open Add Prospect. Ctrl+click to add to list only."
                          className={`cursor-pointer ${
                            taken
                              ? "bg-slate-50 text-slate-400"
                              : i === highlight
                                ? "bg-slate-100"
                                : "hover:bg-slate-50"
                          }`}
                          onMouseEnter={() => setHighlight(i)}
                          onClick={(e) => handleSuggestionRowClick(e, s)}
                        >
                          <td className="max-w-[10rem] px-2 py-2 align-top font-medium text-slate-900 sm:max-w-none sm:px-3 sm:py-2.5">
                            <span className="break-all font-mono text-xs sm:text-sm">
                              {s.quote_number || "—"}
                            </span>
                            {taken ? (
                              <span className="ml-1 block text-[10px] font-normal text-emerald-600 sm:inline sm:ml-1.5 sm:text-xs">
                                (added)
                              </span>
                            ) : null}
                          </td>
                          <td className="max-w-[8rem] px-2 py-2 align-top text-slate-700 sm:max-w-none sm:px-3 sm:py-2.5">
                            <span className="line-clamp-2 text-xs sm:text-sm">
                              {s.client_name || "—"}
                            </span>
                          </td>
                          <td className="hidden max-w-[12rem] px-2 py-2 align-top text-slate-700 sm:table-cell sm:px-3 sm:py-2.5">
                            <span className="line-clamp-2 break-all text-xs sm:text-sm">
                              {s.email || "—"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 align-top text-xs text-slate-700 sm:px-3 sm:py-2.5 sm:text-sm">
                            {s.phone || "—"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 align-top text-xs text-slate-700 sm:px-3 sm:py-2.5 sm:text-sm">
                            {formatDate(s.quote_date)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right align-top text-xs text-slate-700 sm:px-3 sm:py-2.5 sm:text-sm">
                            {formatTotal(s.grand_total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
      </div>

      {selectedCustomers.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3 sm:p-4">
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
                  className="inline-flex max-w-full items-start gap-1 rounded-lg border border-slate-200 bg-white py-1.5 pl-2.5 pr-1 text-xs text-slate-800 shadow-sm sm:items-center"
                >
                  <span className="min-w-0 break-words">
                    <span className="font-semibold">{primaryLabel}</span>
                    {c.subtitle ? (
                      <>
                        <span className="hidden sm:inline"> — </span>
                        <span className="block text-slate-500 sm:inline">
                          {c.subtitle}
                        </span>
                      </>
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
    </form>
  );
}
