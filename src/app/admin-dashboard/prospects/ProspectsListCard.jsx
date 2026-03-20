"use client";

import { useEffect, useState, useCallback, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Trash2 } from "lucide-react";
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

export default function ProspectsListCard({
  initialRows = [],
  initialSearch = "",
  initialCustomerIds = [],
  initialQuoteNumbers = [],
  loadError = null,
  viewerUsername = "",
  viewerIsAdmin = false,
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState(initialRows);
  const [searchText, setSearchText] = useState(initialSearch);
  const [selectedCustomers, setSelectedCustomers] = useState(() =>
    buildSelectedFromIdsAndQuotes(initialCustomerIds, initialQuoteNumbers),
  );
  const [tableLoading, setTableLoading] = useState(false);

  const searchTextRef = useRef(searchText);
  searchTextRef.current = searchText;
  const selectedRef = useRef(selectedCustomers);
  selectedRef.current = selectedCustomers;

  const syncKey = `${initialCustomerIds.join("|")}__${initialQuoteNumbers.join("|")}__${initialSearch}`;

  useEffect(() => {
    setRows(initialRows);
    setSearchText(initialSearch);
    setSelectedCustomers(
      buildSelectedFromIdsAndQuotes(initialCustomerIds, initialQuoteNumbers),
    );
  }, [initialRows, syncKey, initialCustomerIds, initialQuoteNumbers, initialSearch]);

  const refreshRows = useCallback(
    async (customerIds, text, quoteNums = []) => {
      setTableLoading(true);
      try {
        const url = buildProspectsRowsApiUrl(customerIds, text);
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
    [],
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
        />
        <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          {loadError}
        </div>
      </>
    );
  }

  const hasFilter =
    selectedCustomers.length > 0 || searchText.trim().length > 0;

  const tableHeaders = [
    "Customer_id",
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
      />

      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (selectedCustomers.length === 0) {
              window.alert(
                "Please add client_id: select a customer from the search bar first.",
              );
              return;
            }
            const customerIds = selectedCustomers.map((c) => c.customer_id);
            const quoteNums = selectedCustomers
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
            router.push(
              `/admin-dashboard/prospects/new?customers=${q}${quoteQs}`,
            );
          }}
          className="inline-flex h-10 items-center justify-center rounded-[10px] bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
        >
          Add Prospects
        </button>
      </div>

      <div className="relative overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-sm">
        {tableLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 text-sm text-slate-500">
            Loading…
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-[56rem] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {tableHeaders.map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
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
                    className="px-4 py-12 text-center text-slate-500"
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
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                      {row.customer_id}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-slate-700">
                      {row.quote_number || "—"}
                    </td>
                    <td
                      className="min-w-[14rem] max-w-xl px-4 py-3 align-top text-slate-800"
                      title={row.model ? String(row.model) : undefined}
                    >
                      <ModelCodesChips rowId={row.id} model={row.model} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                      {row.qty}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                      {formatAmount(row.amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                      {formatDate(row.commitment_date)}
                    </td>
                    <td
                      className="min-w-[10rem] max-w-md px-4 py-3 text-slate-700"
                      title={row.notes ? String(row.notes) : undefined}
                    >
                      {formatNotesPreview(row.notes)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
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
                        className="max-w-[10rem] truncate px-4 py-3 text-slate-600"
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
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-1.5">
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
