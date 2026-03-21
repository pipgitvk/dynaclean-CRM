"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, User, IndianRupee, ListChecks, ChevronRight, Search, LayoutList } from "lucide-react";

function parseIdTokens(raw) {
  if (raw == null || raw === "") return [];
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildSummary(rows) {
  const summaryMap = {};
  for (const row of rows) {
    const client = row.client_name || "—";
    const group = row.group_name || "—";
    const key = `${client}|||${group}`;
    if (!summaryMap[key]) {
      summaryMap[key] = {
        key,
        client_name: client,
        group_name: group,
        totalAmount: 0,
        hasSubHead: false,
        expenseIdSet: new Set(),
        statementTransIdSet: new Set(),
      };
    }
    const card = summaryMap[key];
    card.totalAmount += Number(row.amount || 0);
    if (row.sub_head && String(row.sub_head).trim() !== "") {
      card.hasSubHead = true;
    }
    if (row.id != null) card.expenseIdSet.add(String(row.id));
    for (const tid of parseIdTokens(row.statement_trans_ids)) {
      card.statementTransIdSet.add(tid);
    }
  }
  return Object.values(summaryMap)
    .map((c) => {
      const expenseIds = [...c.expenseIdSet].sort((a, b) => Number(a) - Number(b));
      const statementTransIds = [...c.statementTransIdSet].sort((a, b) => a.localeCompare(b));
      return {
        key: c.key,
        client_name: c.client_name,
        group_name: c.group_name,
        totalAmount: c.totalAmount,
        hasSubHead: c.hasSubHead,
        expenseIdsLabel: expenseIds.length ? expenseIds.join(", ") : "—",
        statementTransIdsLabel: statementTransIds.length ? statementTransIds.join(", ") : "—",
      };
    })
    .sort(
      (a, b) =>
        a.client_name.localeCompare(b.client_name) || a.group_name.localeCompare(b.group_name),
    );
}

export default function ClientExpensesCardsClient({ rows }) {
  const [txnSearch, setTxnSearch] = useState("");

  const filteredRows = useMemo(() => {
    const q = txnSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const expenseTid = (r.transaction_id || "").toLowerCase();
      const stmtTid = (r.statement_trans_ids || "").toLowerCase();
      return expenseTid.includes(q) || stmtTid.includes(q);
    });
  }, [rows, txnSearch]);

  const summaryCards = useMemo(() => buildSummary(filteredRows), [filteredRows]);

  const txnQueryTrim = txnSearch.trim();
  const isTxnSearchActive = txnQueryTrim.length > 0;

  const viewTargets = useMemo(() => {
    const m = new Map();
    for (const r of filteredRows) {
      const c = r.client_name || "—";
      const g = r.group_name || "—";
      const key = `${c}|||${g}`;
      if (!m.has(key)) m.set(key, { client: c, group: g });
    }
    return Array.from(m.values());
  }, [filteredRows]);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-700">Client Expenses – Summary</h1>
            <Link
              href="/admin-dashboard/client-expenses/cards"
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 whitespace-nowrap"
            >
              Refresh
            </Link>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row lg:flex-wrap gap-2 lg:items-center">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
            <Link
              href="/admin-dashboard/client-expenses/add"
              className="w-full sm:w-auto inline-flex justify-center items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg shadow text-sm font-medium whitespace-nowrap"
            >
              Add Client Expense
            </Link>
            <Link
              href="/admin-dashboard/client-expenses/category"
              className="w-full sm:w-auto inline-flex justify-center items-center bg-gray-700 hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg shadow text-sm font-medium whitespace-nowrap"
            >
              Category
            </Link>
            <Link
              href="/admin-dashboard/client-expenses/sub-category"
              className="w-full sm:w-auto inline-flex justify-center items-center bg-gray-700 hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg shadow text-sm font-medium whitespace-nowrap"
            >
              Sub-category
            </Link>
          </div>
          <div className="relative w-full lg:flex-1 lg:min-w-[220px] lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={txnSearch}
              onChange={(e) => setTxnSearch(e.target.value)}
              placeholder="Search by Transaction ID"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      {isTxnSearchActive && (
        <div className="mb-8 space-y-4">
          {filteredRows.length > 0 ? (
            <>
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="p-3 font-medium">ID</th>
                      <th className="p-3 font-medium">Expense ref</th>
                      <th className="p-3 font-medium">Trans. ID</th>
                      <th className="p-3 font-medium">Expense name</th>
                      <th className="p-3 font-medium">Client</th>
                      <th className="p-3 font-medium">Group</th>
                      <th className="p-3 font-medium">Sub-head</th>
                      <th className="p-3 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRows.map((r) => (
                      <tr key={r.id} className="hover:bg-blue-50/40">
                        <td className="p-3 text-gray-600">{r.id}</td>
                        <td className="p-3 font-mono text-xs text-gray-800">{r.transaction_id || "—"}</td>
                        <td className="p-3 font-mono text-xs text-gray-800">{r.statement_trans_ids || "—"}</td>
                        <td className="p-3 text-gray-800">{r.expense_name || "—"}</td>
                        <td className="p-3 font-medium text-gray-800">{r.client_name || "—"}</td>
                        <td className="p-3 text-gray-600">{r.group_name || "—"}</td>
                        <td className="p-3 text-gray-600 max-w-[140px] truncate" title={r.sub_head || ""}>
                          {r.sub_head || "—"}
                        </td>
                        <td className="p-3 text-right font-semibold text-emerald-700 tabular-nums">
                          {r.amount != null
                            ? `₹${Number(r.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2">
                {viewTargets.map((p) => (
                  <Link
                    key={`${p.client}|||${p.group}`}
                    href={`/admin-dashboard/client-expenses?client=${encodeURIComponent(p.client)}&group=${encodeURIComponent(p.group)}&txn=${encodeURIComponent(txnQueryTrim)}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors"
                  >
                    <LayoutList className="w-4 h-4 shrink-0" />
                    {viewTargets.length > 1 ? `View table · ${p.client} / ${p.group}` : "View table"}
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 py-6">No expenses match this Transaction ID.</p>
          )}
        </div>
      )}

      {!isTxnSearchActive && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const clientQs = encodeURIComponent(card.client_name);
            const groupQs = encodeURIComponent(card.group_name);
            const tableHref = `/admin-dashboard/client-expenses?client=${clientQs}&group=${groupQs}`;
            const subHeadHref = `/admin-dashboard/client-expenses/sub-head-cards?client=${clientQs}&group=${groupQs}`;
            return (
            <Link
              key={card.key}
              href={card.hasSubHead ? subHeadHref : tableHref}
              className={[
                "group relative block text-left rounded-xl border overflow-hidden",
                "shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1",
                card.hasSubHead
                  ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-400"
                  : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div
                className={[
                  "absolute left-0 top-0 bottom-0 w-1",
                  card.hasSubHead ? "bg-gradient-to-b from-blue-500 to-indigo-600" : "bg-gradient-to-b from-slate-400 to-slate-600",
                ].join(" ")}
              />
              <div className="p-4 pl-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <Building2 className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                      <span className="font-medium">group_name:</span>
                    </div>
                    <p className="text-sm font-medium text-gray-700 truncate">{card.group_name}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/80 border border-gray-200 flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <span className="font-medium">client_name:</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 truncate">{card.client_name}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 text-xs text-gray-600 border-t border-gray-100 pt-3">
                  <div className="flex gap-1.5 min-w-0">
                    <span className="font-medium text-gray-500 shrink-0">Expense ID:</span>
                    <span className="font-mono break-all" title={card.expenseIdsLabel}>
                      {card.expenseIdsLabel}
                    </span>
                  </div>
                  <div className="flex gap-1.5 min-w-0">
                    <span className="font-medium text-gray-500 shrink-0">Trans. ID:</span>
                    <span className="font-mono break-all" title={card.statementTransIdsLabel}>
                      {card.statementTransIdsLabel}
                    </span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-emerald-600" />
                    <span className="text-lg font-bold text-gray-800">
                      ₹{card.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <span
                    className={[
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                      card.hasSubHead ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600",
                    ].join(" ")}
                  >
                    <ListChecks className="w-3 h-3" />
                    {card.hasSubHead ? "Has sub-heads" : "No sub-head"}
                  </span>
                </div>
              </div>
            </Link>
            );
          })}

          {rows.length === 0 && (
            <p className="text-sm text-gray-500 col-span-full">No client expenses found.</p>
          )}
        </div>
      )}
    </div>
  );
}
