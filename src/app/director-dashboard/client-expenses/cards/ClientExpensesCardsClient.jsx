"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, User, IndianRupee, ListChecks, ChevronRight, Search, LayoutList, Download, Calendar } from "lucide-react";
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

export default function ClientExpensesCardsClient({ rows }) {
  const router = useRouter();
  const [txnSearch, setTxnSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [router]);

  const filteredRows = useMemo(() => {
    let filtered = rows;
    
    // Filter by transaction ID search
    const q = txnSearch.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((r) => {
        const expenseTid = (r.transaction_id || "").toLowerCase();
        const stmtTid = (r.statement_trans_ids || "").toLowerCase();
        return expenseTid.includes(q) || stmtTid.includes(q);
      });
    }
    
    // Filter by date range
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
        to.setHours(23, 59, 59, 999); // End of the day
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

      // Define columns
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

      // Style the header row
      worksheet.getRow(1).font = { bold: true, size: 12 };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };

      // Add data rows
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

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Create download link
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
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

  const summaryCardsBeforeSort = useMemo(() => buildSummary(filteredRows), [filteredRows]);

  // Apply global search on summary cards
  const filteredSummaryCards = useMemo(() => {
    if (!globalSearch.trim()) return summaryCardsBeforeSort;
    
    const q = globalSearch.toLowerCase();
    const searchNum = parseFloat(globalSearch);
    const isNumericSearch = !isNaN(searchNum) && globalSearch.trim() !== "";
    
    return summaryCardsBeforeSort.filter((card) => {
      // Text search
      const textMatch = 
        card.client_name.toLowerCase().includes(q) ||
        card.group_name.toLowerCase().includes(q) ||
        card.expenseNamesLabel.toLowerCase().includes(q);
      
      // Numeric search for amount (with some tolerance for formatting)
      const amountMatch = isNumericSearch && 
        (card.totalAmount.toString().includes(globalSearch) ||
         card.totalAmount.toFixed(2).includes(globalSearch) ||
         Math.floor(card.totalAmount).toString().includes(globalSearch));
      
      return textMatch || amountMatch;
    });
  }, [summaryCardsBeforeSort, globalSearch]);

  // Apply sorting on summary cards
  const summaryCards = useMemo(() => {
    if (!sortConfig.key) return filteredSummaryCards;
    
    const sorted = [...filteredSummaryCards].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortConfig.key) {
        case "client_name":
          aVal = a.client_name.toLowerCase();
          bVal = b.client_name.toLowerCase();
          break;
        case "group_name":
          aVal = a.group_name.toLowerCase();
          bVal = b.group_name.toLowerCase();
          break;
        case "totalAmount":
          aVal = a.totalAmount;
          bVal = b.totalAmount;
          break;
        default:
          return 0;
      }
      
      if (typeof aVal === "string") {
        return sortConfig.direction === "asc" 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
    });
    
    return sorted;
  }, [filteredSummaryCards, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <span className="ml-1 text-gray-300">↕</span>;
    return <span className="ml-1 font-bold">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>;
  };

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
    <div className="w-full min-h-screen bg-gray-50">
      <div className="max-w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Client Expenses – Summary</h1>
            <Link
              href="/director-dashboard/client-expenses/cards"
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition-colors whitespace-nowrap"
            >
              Refresh
            </Link>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row gap-4 lg:items-end lg:justify-between">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
            <Link
              href="/director-dashboard/client-expenses/add"
              className="inline-flex justify-center items-center bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg shadow-sm text-sm font-semibold whitespace-nowrap transition-colors"
            >
              Add Client Expense
            </Link>
            <Link
              href="/director-dashboard/client-expenses/category"
              className="inline-flex justify-center items-center bg-gray-700 hover:bg-gray-800 text-white px-5 py-2.5 rounded-lg shadow-sm text-sm font-semibold whitespace-nowrap transition-colors"
            >
              Category
            </Link>
            <Link
              href="/director-dashboard/client-expenses/sub-category"
              className="inline-flex justify-center items-center bg-gray-700 hover:bg-gray-800 text-white px-5 py-2.5 rounded-lg shadow-sm text-sm font-semibold whitespace-nowrap transition-colors"
            >
              Sub-category
            </Link>
            <button
              onClick={handleExportToExcel}
              disabled={isExporting || filteredRows.length === 0}
              className="inline-flex justify-center items-center bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg shadow-sm text-sm font-semibold whitespace-nowrap gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Exporting..." : "Export Excel"}
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 lg:w-auto">
            <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-lg border border-gray-200">
              <Calendar className="w-4 h-4 text-gray-500" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-0 py-0 border-none text-sm focus:ring-0 focus:outline-none bg-transparent text-gray-700"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-0 py-0 border-none text-sm focus:ring-0 focus:outline-none bg-transparent text-gray-700"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="search"
                value={txnSearch}
                onChange={(e) => setTxnSearch(e.target.value)}
                placeholder="Search by Transaction ID"
                className="pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none w-full sm:w-64"
                autoComplete="off"
              />
            </div>
          </div>
        </div>

        {/* Global Search Filter */}
        {!isTxnSearchActive && (
          <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-lg border border-gray-200 shadow-sm">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search Client, Group, Expense, or Amount..."
              className="flex-1 border-none text-sm focus:ring-0 focus:outline-none bg-transparent text-gray-700 placeholder-gray-400"
              autoComplete="off"
            />
            {globalSearch && (
              <button
                onClick={() => setGlobalSearch("")}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {isTxnSearchActive && (
        <div className="mb-8 space-y-6">
          {filteredRows.length > 0 ? (
            <>
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                      <tr className="text-left font-semibold text-gray-700 border-b border-gray-300">
                        <th className="px-6 py-3">Expense ref</th>
                        <th className="px-6 py-3">Expense name</th>
                        <th className="px-6 py-3">Client</th>
                        <th className="px-6 py-3">Group</th>
                        <th className="px-6 py-3">Sub-head</th>
                        <th className="px-6 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-gray-800">
                      {filteredRows.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 font-mono text-xs font-semibold bg-gray-50">{r.transaction_id || "—"}</td>
                          <td className="px-6 py-3 font-medium">{r.expense_name || "—"}</td>
                          <td className="px-6 py-3 font-semibold text-gray-900">{r.client_name || "—"}</td>
                          <td className="px-6 py-3">{r.group_name || "—"}</td>
                          <td className="px-6 py-3 max-w-xs truncate" title={r.sub_head || ""}>
                            {r.sub_head || "—"}
                          </td>
                          <td className="px-6 py-3 text-right font-bold text-emerald-600 tabular-nums">
                            {r.amount != null
                              ? `₹${Number(r.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                      
                      {/* Total Row */}
                      <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                        <td colSpan="5" className="px-6 py-3 text-right">
                          Total:
                        </td>
                        <td className="px-6 py-3 text-right text-emerald-700">
                          ₹{filteredRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {viewTargets.map((p) => (
                  <Link
                    key={`${p.client}|||${p.group}`}
                    href={`/director-dashboard/client-expenses?client=${encodeURIComponent(p.client)}&group=${encodeURIComponent(p.group)}&txn=${encodeURIComponent(txnQueryTrim)}`}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors"
                  >
                    <LayoutList className="w-4 h-4 shrink-0" />
                    {viewTargets.length > 1 ? `View table · ${p.client} / ${p.group}` : "View table"}
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 py-6 text-center bg-white p-4 rounded-lg">No expenses match this Transaction ID.</p>
          )}
        </div>
      )}

      {!isTxnSearchActive && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr className="text-left font-semibold text-gray-700 border-b border-gray-300">
                    <th className="px-6 py-3 cursor-pointer select-none hover:bg-gray-200 transition-colors" onClick={() => handleSort("client_name")}>
                      Client Name <SortIcon column="client_name" />
                    </th>
                    <th className="px-6 py-3 cursor-pointer select-none hover:bg-gray-200 transition-colors" onClick={() => handleSort("group_name")}>
                      Group Name <SortIcon column="group_name" />
                    </th>
                    <th className="px-6 py-3">Expense Names</th>
                    <th className="px-6 py-3">Sub-Head Status</th>
                    <th className="px-6 py-3 cursor-pointer select-none hover:bg-gray-200 transition-colors text-right" onClick={() => handleSort("totalAmount")}>
                      Total Amount <SortIcon column="totalAmount" />
                    </th>
                    <th className="px-6 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-gray-800">
                  {/* Employee Expenses Row */}
                  <tr className="bg-indigo-50 hover:bg-indigo-100 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-indigo-600 shrink-0" />
                        <span className="font-semibold text-indigo-900">Employee Expenses</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">—</td>
                    <td className="px-6 py-4 text-gray-700">View expenses by employee</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-indigo-200 text-indigo-800">
                        <ListChecks className="w-3 h-3" />
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold">—</td>
                    <td className="px-6 py-4 text-center">
                      <Link
                        href="/director-dashboard/client-expenses/employee-cards"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                      >
                        View
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>

                  {/* Summary Cards Rows */}
                  {summaryCards.map((card) => {
                    const clientQs = encodeURIComponent(card.client_name);
                    const groupQs = encodeURIComponent(card.group_name);
                    const tableHref = `/director-dashboard/client-expenses?client=${clientQs}&group=${groupQs}`;
                    const subHeadHref = `/director-dashboard/client-expenses/sub-head-cards?client=${clientQs}&group=${groupQs}`;
                    const hrefToUse = card.hasSubHead ? subHeadHref : tableHref;
                    
                    return (
                      <tr key={card.key} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="font-medium text-gray-900">{card.client_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-800">{card.group_name}</td>
                        <td className="px-6 py-4 text-gray-700 max-w-xs truncate" title={card.expenseNamesLabel}>
                          {card.expenseNamesLabel}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={[
                              "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
                              card.hasSubHead ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700",
                            ].join(" ")}
                          >
                            <ListChecks className="w-3 h-3" />
                            {card.hasSubHead ? "Has sub-heads" : "No sub-head"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-600 tabular-nums">
                          ₹{card.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Link
                            href={hrefToUse}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                          >
                            View
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}

                  {summaryCards.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-gray-500 font-medium">
                        No client expenses found.
                      </td>
                    </tr>
                  )}

                  {/* Total Row */}
                  {summaryCards.length > 0 && (
                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                      <td colSpan="4" className="px-6 py-3 text-right">
                        Total:
                      </td>
                      <td className="px-6 py-3 text-right text-emerald-700">
                        ₹{summaryCards.reduce((sum, card) => sum + card.totalAmount, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-3"></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
