"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Download,
  Calendar,
  ChevronUp,
  ChevronDown,
  X,
  Inbox,
  LayoutList,
  RotateCcw,
  User,
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
  return Object.values(summaryMap).map((c) => {
    const expenseNames = [...c.expenseNameSet].sort((a, b) => a.localeCompare(b));
    return {
      key: c.key,
      client_name: c.client_name,
      group_name: c.group_name,
      totalAmount: c.totalAmount,
      hasSubHead: c.hasSubHead,
      expenseNamesLabel: expenseNames.length ? expenseNames.join(", ") : "—",
      subHeadLabel: c.hasSubHead ? "Has sub-heads" : "No sub-head",
    };
  });
}

function rowMatchesSearch(row, q) {
  if (!q) return true;
  return Object.values(row)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function summaryDisplayText(summary) {
  return [
    summary.client_name,
    summary.group_name,
    summary.expenseNamesLabel,
    summary.subHeadLabel,
    summary.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
  ]
    .join(" ")
    .toLowerCase();
}

function rowGroupKey(row) {
  return `${row.client_name || "—"}|||${row.group_name || "—"}`;
}

export default function ClientExpensesCardsClient({ rows }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [subHeadFilter, setSubHeadFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "client_name", direction: "asc" });
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [router]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let filtered = rows;

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

    if (q) {
      const summaries = buildSummary(filtered);
      const keysFromTableText = new Set(
        summaries.filter((s) => summaryDisplayText(s).includes(q)).map((s) => s.key),
      );
      filtered = filtered.filter(
        (r) => rowMatchesSearch(r, q) || keysFromTableText.has(rowGroupKey(r)),
      );
    }

    return filtered;
  }, [rows, searchQuery, fromDate, toDate]);

  const summaryRows = useMemo(() => {
    let list = buildSummary(filteredRows);

    if (subHeadFilter === "has") {
      list = list.filter((r) => r.hasSubHead);
    } else if (subHeadFilter === "none") {
      list = list.filter((r) => !r.hasSubHead);
    }

    return list;
  }, [filteredRows, subHeadFilter]);

  const sortedSummaryRows = useMemo(() => {
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    const key = sortConfig.key;

    const getVal = (row) => {
      switch (key) {
        case "client_name":
          return (row.client_name || "").toLowerCase();
        case "group_name":
          return (row.group_name || "").toLowerCase();
        case "expenseNamesLabel":
          return (row.expenseNamesLabel || "").toLowerCase();
        case "totalAmount":
          return Number(row.totalAmount || 0);
        case "subHeadLabel":
          return (row.subHeadLabel || "").toLowerCase();
        default:
          return (row.client_name || "").toLowerCase();
      }
    };

    return [...summaryRows].sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * dir;
      }
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [summaryRows, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return null;
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="inline w-4 h-4 ml-0.5" />
    ) : (
      <ChevronDown className="inline w-4 h-4 ml-0.5" />
    );
  };

  const handleReset = () => {
    setSearchQuery("");
    setFromDate("");
    setToDate("");
    setSubHeadFilter("all");
    setSortConfig({ key: "client_name", direction: "asc" });
  };

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

  const searchTrim = searchQuery.trim();
  const txnParam = searchTrim ? `&txn=${encodeURIComponent(searchTrim)}` : "";

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-700">Client Expenses – Summary</h1>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 shadow-sm w-full sm:w-auto"
          >
            <RotateCcw size={16} />
            Refresh
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
          <Link
            href="/admin-dashboard/client-expenses/add"
            className="w-full sm:w-auto inline-flex justify-center items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg shadow text-sm font-medium whitespace-nowrap"
          >
            Add Client Expense
          </Link>
          <Link
            href="/admin-dashboard/client-expenses/employee-cards"
            className="w-full sm:w-auto inline-flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg shadow text-sm font-medium whitespace-nowrap"
          >
            <User className="w-4 h-4" />
            Employee Expenses
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

        <div className="flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-2 lg:gap-3">
            <div className="relative w-full lg:flex-1 lg:min-w-[220px] lg:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search anything on this page..."
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                autoComplete="off"
              />
            </div>
            <select
              value={subHeadFilter}
              onChange={(e) => setSubHeadFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              aria-label="Filter by sub-head"
            >
              <option value="all">All sub-head status</option>
              <option value="has">Has sub-heads only</option>
              <option value="none">No sub-head only</option>
            </select>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
                <span className="text-gray-500 shrink-0">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 w-full sm:w-auto shrink-0"
              >
                <X size={14} />
                Reset
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {sortedSummaryRows.length} group{sortedSummaryRows.length === 1 ? "" : "s"} ·{" "}
            {filteredRows.length} expense line{filteredRows.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="overflow-auto bg-white shadow-lg rounded-xl border border-gray-200">
        <table className="min-w-full table-auto text-sm">
          <thead className="bg-gradient-to-r from-slate-700 to-slate-800 sticky top-0 z-10">
            <tr className="text-left font-medium text-white">
              <th
                onClick={() => handleSort("client_name")}
                className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors rounded-tl-xl"
              >
                Client
                <SortIcon column="client_name" />
              </th>
              <th
                onClick={() => handleSort("group_name")}
                className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors"
              >
                Group
                <SortIcon column="group_name" />
              </th>
              <th
                onClick={() => handleSort("expenseNamesLabel")}
                className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors"
              >
                Expense names
                <SortIcon column="expenseNamesLabel" />
              </th>
              <th
                onClick={() => handleSort("totalAmount")}
                className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors text-right"
              >
                Total amount
                <SortIcon column="totalAmount" />
              </th>
              <th
                onClick={() => handleSort("subHeadLabel")}
                className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors"
              >
                Sub-head
                <SortIcon column="subHeadLabel" />
              </th>
              <th className="p-3 rounded-tr-xl">Action</th>
            </tr>
          </thead>
          <tbody className="text-gray-800 bg-white divide-y divide-gray-100">
            {sortedSummaryRows.length > 0 ? (
              sortedSummaryRows.map((card) => {
                const clientQs = encodeURIComponent(card.client_name);
                const groupQs = encodeURIComponent(card.group_name);
                const tableHref = `/admin-dashboard/client-expenses?client=${clientQs}&group=${groupQs}${txnParam}`;
                const subHeadHref = `/admin-dashboard/client-expenses/sub-head-cards?client=${clientQs}&group=${groupQs}`;
                const detailHref = card.hasSubHead ? subHeadHref : tableHref;

                return (
                  <tr key={card.key} className="hover:bg-blue-50/40 transition-colors">
                    <td className="p-3 font-medium text-gray-800">{card.client_name}</td>
                    <td className="p-3 text-gray-600">{card.group_name}</td>
                    <td className="p-3 text-gray-700 max-w-md" title={card.expenseNamesLabel}>
                      {card.expenseNamesLabel}
                    </td>
                    <td className="p-3 text-right font-semibold text-emerald-700 tabular-nums">
                      ₹{card.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3">
                      <span
                        className={[
                          "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                          card.hasSubHead ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600",
                        ].join(" ")}
                      >
                        {card.subHeadLabel}
                      </span>
                    </td>
                    <td className="p-3">
                      <Link
                        href={detailHref}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                      >
                        <LayoutList className="w-3.5 h-3.5 shrink-0" />
                        {card.hasSubHead ? "Sub-head summary" : "View expenses"}
                      </Link>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="p-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Inbox className="w-12 h-12 text-gray-300" />
                    <span className="font-medium">
                      {rows.length === 0 ? "No client expenses found." : "No entries match your search or filters."}
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
