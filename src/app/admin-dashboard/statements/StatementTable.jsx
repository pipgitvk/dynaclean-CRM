"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { Eye, Pencil, X, Upload, Download, FileSpreadsheet, Search, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function StatementTable({ rows }) {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState(() => dayjs().startOf("month").format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(() => dayjs().endOf("month").format("YYYY-MM-DD"));
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "desc" });
  const [modalId, setModalId] = useState(null);
  const [expense, setExpense] = useState(null);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const filteredRows = rows.filter((row) => {
    if (statusFilter) {
      if (statusFilter === "Settled" && !row.client_expense_id) return false;
      if (statusFilter === "Unsettled" && row.client_expense_id) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const transId = (row.trans_id || "").toLowerCase();
      const desc = (row.description || "").toLowerCase();
      const cheqNo = (row.cheq_no || "").toLowerCase();
      const amount = String(row.amount || "");
      if (!transId.includes(q) && !desc.includes(q) && !cheqNo.includes(q) && !amount.includes(q)) return false;
    }
    if (dateFrom || dateTo) {
      const rowDate = row.date ? dayjs(row.date).valueOf() : 0;
      if (dateFrom && rowDate < dayjs(dateFrom).startOf("day").valueOf()) return false;
      if (dateTo && rowDate > dayjs(dateTo).endOf("day").valueOf()) return false;
    }
    return true;
  });

  // Compute running balance (chronological order: date ASC, id ASC)
  const balanceMap = {};
  const chronoRows = [...filteredRows].sort((a, b) => {
    const da = a.date ? dayjs(a.date).valueOf() : 0;
    const db = b.date ? dayjs(b.date).valueOf() : 0;
    if (da !== db) return da - db;
    return (a.id || 0) - (b.id || 0);
  });
  // Debit = minus from balance, Credit = add to balance
  let runningBalance = 0;
  for (const row of chronoRows) {
    const amt = Number(row.amount || 0);
    runningBalance += row.type === "Credit" ? amt : -amt;
    balanceMap[row.id] = runningBalance;
  }

  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    const key = sortConfig.key;

    const getVal = (row) => {
      switch (key) {
        case "id":
          return Number(row.id || 0);
        case "trans_id":
          return (row.trans_id || "").toLowerCase();
        case "date":
          return row.date ? dayjs(row.date).valueOf() : 0;
        case "txn_dated_deb":
          return row.txn_dated_deb ? dayjs(row.txn_dated_deb).valueOf() : 0;
        case "txn_posted_date":
          return row.txn_posted_date ? dayjs(row.txn_posted_date).valueOf() : 0;
        case "cheq_no":
          return (row.cheq_no || "").toLowerCase();
        case "description":
          return (row.description || "").toLowerCase();
        case "debit":
          return row.type === "Debit" ? Number(row.amount || 0) : 0;
        case "credit":
          return row.type === "Credit" ? Number(row.amount || 0) : 0;
        case "status":
          return (row.client_expense_id ? "settled" : "unsettled");
        default:
          return 0;
      }
    };

    const va = getVal(a);
    const vb = getVal(b);
    if (typeof va === "string" || typeof vb === "string") {
      return va.localeCompare(vb) * dir;
    }
    return (va - vb) * dir;
  });

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return null;
    return <span className="ml-1">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>;
  };

  const handleReset = () => {
    setStatusFilter("");
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
  };

  const formatPdfAmount = (n) => {
    const num = Number(n) || 0;
    return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Statements", 14, 15);
    autoTable(doc, {
      startY: 22,
      theme: "plain",
      head: [
        ["ID", "Trans ID", "Date", "Txn Dated Deb", "Txn Posted Date", "Cheq No", "Description", "Debit", "Credit", "Status", "Balance"],
      ],
      body: sortedRows.map((row) => [
        String(row.id),
        (row.trans_id || "-").toString().slice(0, 14),
        row.date ? dayjs(row.date).format("DD MMM YYYY") : "-",
        row.txn_dated_deb && row.txn_dated_deb !== "0000-00-00" ? dayjs(row.txn_dated_deb).format("DD MMM YYYY") : "-",
        row.txn_posted_date && row.txn_posted_date !== "0000-00-00" ? dayjs(row.txn_posted_date).format("DD MMM YYYY") : "-",
        (row.cheq_no || "-").toString().slice(0, 12),
        (row.description || "-").toString().slice(0, 22),
        row.type === "Debit" ? formatPdfAmount(row.amount) : "-",
        row.type === "Credit" ? formatPdfAmount(row.amount) : "-",
        row.client_expense_id ? "Settled" : "Unsettled",
        formatPdfAmount(Math.abs(balanceMap[row.id] ?? 0)),
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 28 },
        2: { cellWidth: 24 },
        3: { cellWidth: 24 },
        4: { cellWidth: 24 },
        5: { cellWidth: 24 },
        6: { cellWidth: 40 },
        7: { cellWidth: 18 },
        8: { cellWidth: 22 },
        9: { cellWidth: 20 },
        10: { cellWidth: 28 },
      },
      margin: { left: 14, right: 14 },
    });
    doc.save(`statements_${dayjs().format("YYYY-MM-DD")}.pdf`);
    toast.success("PDF exported");
  };

  const handleImport = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/statements/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      toast.success(`Imported: ${data.inserted} inserted, ${data.skipped} skipped`);
      router.refresh();
    } catch (err) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleDownloadDemo = (format) => {
    window.open(`/api/statements/demo?format=${format}`, "_blank");
    toast.success(`Demo ${format.toUpperCase()} downloaded`);
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("Delete all statements? This cannot be undone.")) return;
    setDeletingAll(true);
    try {
      const res = await fetch("/api/statements/delete-all", { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success(`Deleted ${data.deleted ?? 0} statement(s)`);
      router.refresh();
    } catch (err) {
      toast.error(err.message || "Delete failed");
    } finally {
      setDeletingAll(false);
    }
  };

  useEffect(() => {
    if (!modalId) {
      setExpense(null);
      setExpenseLoading(false);
      return;
    }
    setExpenseLoading(true);
    setExpense(null);
    fetch(`/api/statements/${modalId}`)
      .then((r) => r.json())
      .then((row) => {
        if (row?.error) throw new Error(row.error);
        if (row.client_expense_id) {
          return fetch(`/api/client-expenses/${row.client_expense_id}`).then((r) => r.json());
        }
        return null;
      })
      .then((exp) => {
        setExpense(exp && !exp.error ? exp : null);
      })
      .catch((e) => {
        toast.error(e.message || "Failed to load");
        setModalId(null);
      })
      .finally(() => setExpenseLoading(false));
  }, [modalId]);

  const filteredUnsettled = filteredRows.filter((r) => !r.client_expense_id).length;
  const filteredSettled = filteredRows.filter((r) => r.client_expense_id).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-700">Statements</h1>
          <span className="text-gray-600 font-normal text-base">
            Unsettled: {filteredUnsettled}, Settled: {filteredSettled}
          </span>
        </div>
        <Link
          href="/admin-dashboard/statements/add"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow w-fit"
        >
          Add New Statement
        </Link>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search Trans ID, Description, Cheq No..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 border rounded-lg w-full sm:w-48 text-sm"
          />
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-4 py-2 border rounded-lg w-full sm:w-36 text-sm"
          title="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-4 py-2 border rounded-lg w-full sm:w-36 text-sm"
          title="To date"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg w-full sm:w-40"
        >
          <option value="">All Status</option>
          <option value="Settled">Settled</option>
          <option value="Unsettled">Unsettled</option>
        </select>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-300 rounded-lg text-sm cursor-pointer w-full sm:w-auto"
        >
          Reset
        </button>
        <div className="flex flex-wrap gap-2 ml-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleImport}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <Upload size={16} />
            {importing ? "Importing..." : "Import (CSV/Excel)"}
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <Download size={16} />
            Export PDF
          </button>
          <button
            type="button"
            onClick={() => handleDownloadDemo("xlsx")}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
            title="Download sample file with correct format (no field mismatch)"
          >
            <FileSpreadsheet size={16} />
            Demo (.xlsx)
          </button>
          {/* <button
            type="button"
            onClick={handleDeleteAll}
            disabled={deletingAll || rows.length === 0}
            className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete all statements"
          >
            <Trash2 size={16} />
            {deletingAll ? "Deleting..." : "Delete All"}
          </button> */}
        </div>
      </div>

      <div className="hidden md:block overflow-auto bg-white shadow rounded-lg">
        <table className="min-w-full table-auto text-sm">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr className="text-left font-semibold text-gray-700">
              <th onClick={() => handleSort("id")} className="p-3 cursor-pointer select-none">ID<SortIcon column="id" /></th>
              <th onClick={() => handleSort("trans_id")} className="p-3 cursor-pointer select-none">Trans ID<SortIcon column="trans_id" /></th>
              <th onClick={() => handleSort("date")} className="p-3 cursor-pointer select-none">Date<SortIcon column="date" /></th>
              <th onClick={() => handleSort("txn_dated_deb")} className="p-3 cursor-pointer select-none">Txn Dated Deb<SortIcon column="txn_dated_deb" /></th>
              <th onClick={() => handleSort("txn_posted_date")} className="p-3 cursor-pointer select-none">Txn Posted Date<SortIcon column="txn_posted_date" /></th>
              <th onClick={() => handleSort("cheq_no")} className="p-3 cursor-pointer select-none">Cheq No<SortIcon column="cheq_no" /></th>
              <th onClick={() => handleSort("description")} className="p-3 cursor-pointer select-none">Description<SortIcon column="description" /></th>
              <th onClick={() => handleSort("debit")} className="p-3 cursor-pointer select-none">Debit<SortIcon column="debit" /></th>
              <th onClick={() => handleSort("credit")} className="p-3 cursor-pointer select-none">Credit<SortIcon column="credit" /></th>
              <th onClick={() => handleSort("status")} className="p-3 cursor-pointer select-none">Status<SortIcon column="status" /></th>
              <th className="p-3">Balance</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody className="text-gray-800 divide-y divide-gray-200">
            {sortedRows.length > 0 ? (
              sortedRows.map((row) => (
                <tr key={row.id}>
                  <td className="p-3">{row.id}</td>
                  <td className="p-3">{row.trans_id}</td>
                  <td className="p-3">
                    {row.date ? dayjs(row.date).format("DD MMM YYYY") : "-"}
                  </td>
                  <td className="p-3">
                    {row.txn_dated_deb && row.txn_dated_deb !== "0000-00-00"
                      ? dayjs(row.txn_dated_deb).format("DD MMM YYYY")
                      : "-"}
                  </td>
                  <td className="p-3">
                    {row.txn_posted_date && row.txn_posted_date !== "0000-00-00"
                      ? dayjs(row.txn_posted_date).format("DD MMM YYYY")
                      : "-"}
                  </td>
                  <td className="p-3">{row.cheq_no || "-"}</td>
                  <td className="p-3 max-w-[200px] truncate" title={row.description}>{row.description || "-"}</td>
                  <td className="p-3 text-red-600">
                    {row.type === "Debit" ? `₹${Number(row.amount || 0).toFixed(2)}` : "-"}
                  </td>
                  <td className="p-3 text-green-600">
                    {row.type === "Credit" ? `₹${Number(row.amount || 0).toFixed(2)}` : "-"}
                  </td>
                  <td className="p-3">
                    <span className={row.client_expense_id ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                      {row.client_expense_id ? "Settled" : "Unsettled"}
                    </span>
                  </td>
                  <td className="p-3 font-medium">
                    ₹{Math.abs(balanceMap[row.id] ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td className="p-3 flex gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => setModalId(row.id)}
                      className="text-blue-600 hover:underline"
                      title="View"
                    >
                      <Eye size={16} />
                    </button>
                    <Link
                      href={`/admin-dashboard/statements/edit/${row.id}`}
                      className="text-yellow-600 hover:text-yellow-800"
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="12" className="p-4 text-center text-gray-500">
                  No entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-4">
        {sortedRows.length === 0 && (
          <div className="text-center text-gray-500">No entries found.</div>
        )}
        {sortedRows.map((row) => (
          <div
            key={row.id}
            className="border rounded-lg p-4 shadow-sm bg-white text-sm space-y-1"
          >
            <div><strong>ID:</strong> {row.id}</div>
            <div><strong>Trans ID:</strong> {row.trans_id}</div>
            <div><strong>Date:</strong> {row.date ? dayjs(row.date).format("DD MMM YYYY") : "-"}</div>
            <div><strong>Txn Dated Deb:</strong> {row.txn_dated_deb && row.txn_dated_deb !== "0000-00-00" ? dayjs(row.txn_dated_deb).format("DD MMM YYYY") : "-"}</div>
            <div><strong>Txn Posted Date:</strong> {row.txn_posted_date && row.txn_posted_date !== "0000-00-00" ? dayjs(row.txn_posted_date).format("DD MMM YYYY") : "-"}</div>
            <div><strong>Cheq No:</strong> {row.cheq_no || "-"}</div>
            <div><strong>Description:</strong> {row.description || "-"}</div>
            <div><strong>Debit:</strong> <span className="text-red-600">{row.type === "Debit" ? `₹${Number(row.amount || 0).toFixed(2)}` : "-"}</span></div>
            <div><strong>Credit:</strong> <span className="text-green-600">{row.type === "Credit" ? `₹${Number(row.amount || 0).toFixed(2)}` : "-"}</span></div>
            <div><strong>Status:</strong> <span className={row.client_expense_id ? "text-green-600" : "text-amber-600"}>{row.client_expense_id ? "Settled" : "Unsettled"}</span></div>
            <div className="flex items-center gap-4 pt-2">
              <button type="button" onClick={() => setModalId(row.id)} className="text-blue-600 hover:underline">
                <Eye size={16} /> View
              </button>
              <Link href={`/admin-dashboard/statements/edit/${row.id}`} className="text-yellow-600 hover:text-yellow-800">
                <Pencil size={16} /> Edit
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Expense View Modal */}
      {modalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Client Expense Details</h3>
              <button
                type="button"
                onClick={() => setModalId(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              {expenseLoading ? (
                <div className="py-8 text-center text-gray-500">Loading...</div>
              ) : expense ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                    <div className="space-y-2">
                      <p><span className="font-medium">ID:</span> {expense.id}</p>
                      <p><span className="font-medium">Expense Name:</span> {expense.expense_name}</p>
                      <p><span className="font-medium">Client Name:</span> {expense.client_name}</p>
                      <p><span className="font-medium">Group Name:</span> {expense.group_name || "-"}</p>
                      <p><span className="font-medium">Tax applicable:</span> {expense.tax_applicable ? "Yes" : "No"}</p>
                      {expense.tax_applicable && (
                        <>
                          {expense.gst_rate != null && <p><span className="font-medium">Tax Rate:</span> {Number(expense.gst_rate)}%</p>}
                          {expense.tax_type && <p><span className="font-medium">Tax type:</span> {expense.tax_type}</p>}
                          {expense.tax_type === "CGST+SGST" && (
                            <>
                              <p><span className="font-medium">CGST:</span> {expense.cgst != null ? `₹${Number(expense.cgst).toFixed(2)}` : "-"}</p>
                              <p><span className="font-medium">SGST:</span> {expense.sgst != null ? `₹${Number(expense.sgst).toFixed(2)}` : "-"}</p>
                            </>
                          )}
                          {expense.tax_type === "IGST" && <p><span className="font-medium">IGST:</span> {expense.igst != null ? `₹${Number(expense.igst).toFixed(2)}` : "-"}</p>}
                        </>
                      )}
                      <p><span className="font-medium">Main Head:</span> <span className={expense.main_head === "Direct" ? "text-blue-600" : "text-amber-600"}>{expense.main_head}</span></p>
                      <p><span className="font-medium">Head:</span> {expense.head || "-"}</p>
                      <p><span className="font-medium">Supply:</span> {expense.supply || "-"}</p>
                      {expense.sub_heads?.length > 0 && <p><span className="font-medium">Sub-head:</span> {expense.sub_heads[0]}</p>}
                    </div>
                    <div className="space-y-2">
                      <p><span className="font-medium">Type of Ledger:</span> {expense.type_of_ledger || "-"}</p>
                      <p><span className="font-medium">HSN:</span> {expense.hsn || "-"}</p>
                      <p><span className="font-medium">Amount:</span> {expense.amount != null ? `₹${Number(expense.amount).toFixed(2)}` : "-"}</p>
                      <p><span className="font-medium">Created:</span> {expense.created_at ? dayjs(expense.created_at).format("DD MMM YYYY HH:mm") : "-"}</p>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Link
                      href={`/admin-dashboard/client-expenses/edit/${expense.id}?from=statements`}
                      className="px-6 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    >
                      Edit Expenses
                    </Link>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-gray-500">No expense linked to this statement</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
