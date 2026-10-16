"use client";

import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  ListChecks,
  ChevronRight,
  Search,
  LayoutList,
  Download,
  Calendar,
} from "lucide-react";
import ExcelJS from "exceljs";

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
        expenseNameSet: new Set(),
      };
    }
    const card = summaryMap[key];
    card.totalAmount += Number(row.amount || 0);
    if (row.sub_head && String(row.sub_head).trim() !== "") {
      card.hasSubHead = true;
    }
    const en = row.expense_name != null ? String(row.expense_name).trim() : "";
    if (en) card.expenseNameSet.add(en);
  }
  return Object.values(summaryMap)
    .map((c) => {
      const expenseNames = [...c.expenseNameSet].sort((a, b) => a.localeCompare(b));
      return {
        key: c.key,
        client_name: c.client_name,
        group_name: c.group_name,
        totalAmount: c.totalAmount,
        hasSubHead: c.hasSubHead,
        expenseNamesLabel: expenseNames.length ? expenseNames.join(", ") : "—",
      };
    })
    .sort(
      (a, b) =>
        a.client_name.localeCompare(b.client_name) || a.group_name.localeCompare(b.group_name),
    );
}

function clientExpensesPaths(dashboardBase) {
  const base = `/${dashboardBase}/client-expenses`;
  return {
    cards: `${base}/cards`,
    add: `${base}/add`,
    category: `${base}/category`,
    subCategory: `${base}/sub-category`,
    employeeCards: `${base}/employee-cards`,
    list: base,
    subHeadCards: `${base}/sub-head-cards`,
  };
}

export default function ClientExpensesCardsClient({ rows, dashboardBase = "accounts-dashboard" }) {
  const paths = clientExpensesPaths(dashboardBase);
  const router = useRouter();
  const [txnSearch, setTxnSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [router]);

  const filteredRows = useMemo(() => {
    let filtered = rows;

    const q = txnSearch.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((r) => {
        const expenseTid = (r.transaction_id || "").toLowerCase();
        const stmtTid = (r.statement_trans_ids || "").toLowerCase();
        return expenseTid.includes(q) || stmtTid.includes(q);
      });
    }

    if (fromDate) {
      filtered = filtered.filter((r) => {
        const expenseDate = new Date(r.created_at);
        const from = new Date(fromDate);
        return expenseDate >= from;
      });
    }

    if (toDate) {
      filtered = filtered.filter((r) => {
        const expenseDate = new Date(r.created_at);
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        return expenseDate <= to;
      });
    }

    return filtered;
  }, [rows, txnSearch, fromDate, toDate]);

  const handleExportToExcel = async () => {
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Client Expenses");

      worksheet.columns = [
        { header: "ID", key: "id", width: 10 },
        { header: "Expense Name", key: "expense_name", width: 30 },
        { header: "Client Name", key: "client_name", width: 25 },
        { header: "Group Name", key: "group_name", width: 25 },
        { header: "Main Head", key: "main_head", width: 15 },
        { header: "Head", key: "head", width: 20 },
        { header: "Supply", key: "supply", width: 15 },
        { header: "Type of Ledger", key: "type_of_ledger", width: 20 },
        { header: "CGST", key: "cgst", width: 12 },
        { header: "SGST", key: "sgst", width: 12 },
        { header: "IGST", key: "igst", width: 12 },
        { header: "HSN", key: "hsn", width: 15 },
        { header: "Transaction ID", key: "transaction_id", width: 20 },
        { header: "GST Rate", key: "gst_rate", width: 12 },
        { header: "Amount", key: "amount", width: 15 },
        { header: "Tax Applicable", key: "tax_applicable", width: 15 },
        { header: "Tax Type", key: "tax_type", width: 15 },
        { header: "Sub Head", key: "sub_head", width: 30 },
        { header: "Statement Trans IDs", key: "statement_trans_ids", width: 30 },
        { header: "Created At", key: "created_at", width: 20 },
        { header: "Updated At", key: "updated_at", width: 20 },
      ];

      worksheet.getRow(1).font = { bold: true, size: 12 };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };

      filteredRows.forEach((row) => {
        worksheet.addRow({
          id: row.id,
          expense_name: row.expense_name || "",
          client_name: row.client_name || "",
          group_name: row.group_name || "",
          main_head: row.main_head || "",
          head: row.head || "",
          supply: row.supply || "",
          type_of_ledger: row.type_of_ledger || "",
          cgst: row.cgst || 0,
          sgst: row.sgst || 0,
          igst: row.igst || 0,
          hsn: row.hsn || "",
          transaction_id: row.transaction_id || "",
          gst_rate: row.gst_rate || 0,
          amount: row.amount || 0,
          tax_applicable: row.tax_applicable ? "Yes" : "No",
          tax_type: row.tax_type || "",
          sub_head: row.sub_head || "",
          statement_trans_ids: row.statement_trans_ids || "",
          created_at: row.created_at ? new Date(row.created_at).toLocaleString() : "",
          updated_at: row.updated_at ? new Date(row.updated_at).toLocaleString() : "",
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `client_expenses_${fromDate || "all"}_${toDate || "all"}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
      alert("Failed to export data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

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
              href={paths.cards}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 whitespace-nowrap"
            >
              Refresh
            </Link>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row lg:flex-wrap gap-2 lg:items-center">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
            <Link
              href={paths.add}
              className="w-full sm:w-auto inline-flex justify-center items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg shadow text-sm font-medium whitespace-nowrap"
            >
              Add Client Expense
            </Link>
            <Link
              href={paths.category}
              className="w-full sm:w-auto inline-flex justify-center items-center bg-gray-700 hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg shadow text-sm font-medium whitespace-nowrap"
            >
              Category
            </Link>
            <Link
              href={paths.subCategory}
              className="w-full sm:w-auto inline-flex justify-center items-center bg-gray-700 hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg shadow text-sm font-medium whitespace-nowrap"
            >
              Sub-category
            </Link>
            <Link
              href={paths.employeeCards}
              className="w-full sm:w-auto inline-flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg shadow text-sm font-medium whitespace-nowrap"
            >
              <User className="w-4 h-4" />
              Employee Expenses
            </Link>
            <button
              type="button"
              onClick={handleExportToExcel}
              disabled={isExporting || filteredRows.length === 0}
              className="w-full sm:w-auto inline-flex justify-center items-center bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg shadow text-sm font-medium whitespace-nowrap gap-2"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Exporting..." : "Export Excel"}
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <TypeableDateFilterInput
                value={fromDate}
                onChange={setFromDate}
                className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
              <span className="text-gray-500">to</span>
              <TypeableDateFilterInput
                value={toDate}
                onChange={setToDate}
                className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
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
      </div>

      {isTxnSearchActive && (
        <div className="mb-8 space-y-4">
          {filteredRows.length > 0 ? (
            <>
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="p-3 font-medium">Expense ref</th>
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
                        <td className="p-3 font-mono text-xs text-gray-800">{r.transaction_id || "—"}</td>
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
                    href={`${paths.list}?client=${encodeURIComponent(p.client)}&group=${encodeURIComponent(p.group)}&txn=${encodeURIComponent(txnQueryTrim)}`}
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
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="p-3 font-medium">Group</th>
                <th className="p-3 font-medium">Client</th>
                <th className="p-3 font-medium">Expense name</th>
                <th className="p-3 font-medium text-right">Amount</th>
                <th className="p-3 font-medium">Sub-head</th>
                <th className="p-3 font-medium w-[100px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summaryCards.length > 0 ? (
                summaryCards.map((card) => {
                  const clientQs = encodeURIComponent(card.client_name);
                  const groupQs = encodeURIComponent(card.group_name);
                  const tableHref = `${paths.list}?client=${clientQs}&group=${groupQs}`;
                  const subHeadHref = `${paths.subHeadCards}?client=${clientQs}&group=${groupQs}`;
                  const openHref = card.hasSubHead ? subHeadHref : tableHref;
                  return (
                    <tr
                      key={card.key}
                      className={`hover:bg-blue-50/40 ${card.hasSubHead ? "bg-blue-50/20" : ""}`}
                    >
                      <td className="p-3 text-gray-700 font-medium">{card.group_name}</td>
                      <td className="p-3 text-gray-800 font-semibold">{card.client_name}</td>
                      <td className="p-3 text-gray-800 max-w-md" title={card.expenseNamesLabel}>
                        {card.expenseNamesLabel}
                      </td>
                      <td className="p-3 text-right font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                        ₹{card.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3">
                        <span
                          className={[
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                            card.hasSubHead ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600",
                          ].join(" ")}
                        >
                          <ListChecks className="w-3 h-3 shrink-0" />
                          {card.hasSubHead ? "Has sub-heads" : "No sub-head"}
                        </span>
                      </td>
                      <td className="p-3">
                        <Link
                          href={openHref}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-xs"
                        >
                          Open
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No client expenses found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
