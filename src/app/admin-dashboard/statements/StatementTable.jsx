"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { useState, useEffect, useRef, useMemo } from "react";
import toast from "react-hot-toast";
import { Eye, Pencil, X, Upload, Download, FileSpreadsheet, Search, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function StatementTable({ rows }) {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const STORAGE_KEY = "statements.filters.v1";
  const readPersisted = () => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const persisted = readPersisted();
  const defaultMonthStart = () => dayjs().startOf("month").format("YYYY-MM-DD");
  const defaultMonthEnd = () => dayjs().endOf("month").format("YYYY-MM-DD");
  const [statusFilter, setStatusFilter] = useState(() => persisted?.statusFilter ?? "");
  const [searchQuery, setSearchQuery] = useState(() => persisted?.searchQuery ?? "");
  const [dateFrom, setDateFrom] = useState(
    () => persisted?.dateFrom ?? defaultMonthStart()
  );
  const [dateTo, setDateTo] = useState(
    () => persisted?.dateTo ?? defaultMonthEnd()
  );
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "desc" });
  const [modalId, setModalId] = useState(null);
  const [expense, setExpense] = useState(null);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [skippedRows, setSkippedRows] = useState([]);
  const [showSkippedModal, setShowSkippedModal] = useState(false);
  const [selectedSkipped, setSelectedSkipped] = useState(new Set());
  const [forceImporting, setForceImporting] = useState(false);
  const [editData, setEditData] = useState({});   // idx → {trans_id,date,type,amount,description}
  const [forceResult, setForceResult] = useState(null); // {inserted,updated,errors}
  /** When search is numeric expense id: expense.transaction_id for trans_id match (unsettled rows). */
  const [expenseTxnForIdSearch, setExpenseTxnForIdSearch] = useState(null);
  const [expenseIdResolved, setExpenseIdResolved] = useState(null);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!/^\d+$/.test(q)) {
      setExpenseTxnForIdSearch(null);
      setExpenseIdResolved(null);
      return;
    }
    setExpenseIdResolved(q);
    setExpenseTxnForIdSearch(null);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/client-expenses/${q}`, { credentials: "include" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setExpenseTxnForIdSearch(null);
          return;
        }
        const tid = data.transaction_id != null ? String(data.transaction_id).trim() : "";
        setExpenseTxnForIdSearch(tid || null);
      } catch {
        if (!cancelled) setExpenseTxnForIdSearch(null);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchQuery]);

  const getLinkedPurchaseIds = (row) => {
    const raw = row?.linked_purchase_ids;
    if (raw == null || String(raw).trim() === "") return [];
    try {
      const parsed = JSON.parse(String(raw));
      if (Array.isArray(parsed)) {
        return parsed
          .map((x) => Number(x))
          .filter((x) => Number.isFinite(x) && x > 0);
      }
    } catch {}
    return String(raw)
      .split(",")
      .map((x) => Number(String(x).trim()))
      .filter((x) => Number.isFinite(x) && x > 0);
  };

  const isSettledRow = (row) => {
    const linked = getLinkedPurchaseIds(row);
    const inv = String(row?.invoice_status ?? "").trim();
    if (inv === "Settled") return true;
    if (row?.client_expense_id) return true;
    if (linked.length > 0) return true;
    return false;
  };

  const displayInvoiceStatus = (row) => {
    const linked = getLinkedPurchaseIds(row);
    const inv = row?.invoice_status != null ? String(row.invoice_status).trim() : "";
    if ((inv === "" || inv === "Unsettled") && linked.length > 0) return "Settled";
    if (inv) return inv;
    return row?.client_expense_id ? "Settled" : "Unsettled";
  };

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter) {
        const settled = isSettledRow(row);
        if (statusFilter === "Settled" && !settled) return false;
        if (statusFilter === "Unsettled" && settled) return false;
      }
      if (searchQuery.trim()) {
        const qRaw = searchQuery.trim();
        const q = qRaw.toLowerCase();
        const isNumericExpenseSearch = /^\d+$/.test(qRaw);
        const matchesExpenseLinked =
          isNumericExpenseSearch &&
          row.client_expense_id != null &&
          String(row.client_expense_id) === qRaw;
        const rowTransNorm = String(row.trans_id || "").trim().toLowerCase();
        const expenseTxnNorm = expenseTxnForIdSearch ? expenseTxnForIdSearch.toLowerCase() : "";
        const matchesExpenseByTransId =
          isNumericExpenseSearch &&
          expenseIdResolved === qRaw &&
          expenseTxnNorm !== "" &&
          rowTransNorm === expenseTxnNorm;

        // Digits-only = expense ID: only linked row OR statement.trans_id === that expense's transaction_id.
        // (Do not use substring on Trans ID / amount — e.g. "2" must not match S69523907 or ₹2183.)
        if (isNumericExpenseSearch) {
          if (!matchesExpenseLinked && !matchesExpenseByTransId) return false;
        } else {
          const transId = (row.trans_id || "").toLowerCase();
          const desc = (row.description || "").toLowerCase();
          const cheqNo = (row.cheq_no || "").toLowerCase();
          const amount = String(row.amount || "");
          const invoiceNo = (row.invoice_number || "").toLowerCase();
          if (
            !transId.includes(q) &&
            !desc.includes(q) &&
            !cheqNo.includes(q) &&
            !amount.includes(q) &&
            !invoiceNo.includes(q)
          ) {
            return false;
          }
        }
      }
      if (dateFrom || dateTo) {
        const rowDate = row.date ? dayjs(row.date).valueOf() : 0;
        if (dateFrom && rowDate < dayjs(dateFrom).startOf("day").valueOf()) return false;
        if (dateTo && rowDate > dayjs(dateTo).endOf("day").valueOf()) return false;
      }
      return true;
    });
  }, [rows, statusFilter, searchQuery, dateFrom, dateTo, expenseTxnForIdSearch, expenseIdResolved]);

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

  /** Bank file balance when imported; else return null to show no balance */
  const displayBalance = (row) => {
    const cb = row.closing_balance;
    if (cb != null && cb !== "" && !Number.isNaN(Number(cb))) {
      return Number(cb);
    }
    return null;
  };

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
          return (isSettledRow(row) ? "settled" : "unsettled");
        case "balance":
          return displayBalance(row);
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

  // Persist filters so typed search doesn't clear unless user hits Reset.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const isDefaultMonthRange =
        dateFrom === defaultMonthStart() && dateTo === defaultMonthEnd();
      // Reset / default view: no search, no status, current month — don't persist.
      if (!statusFilter && !searchQuery && isDefaultMonthRange) {
        window.sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ statusFilter, searchQuery, dateFrom, dateTo })
      );
    } catch {
      // ignore storage errors (quota / privacy mode)
    }
  }, [statusFilter, searchQuery, dateFrom, dateTo]);

  const handleReset = () => {
    setStatusFilter("");
    setSearchQuery("");
    setDateFrom(defaultMonthStart());
    setDateTo(defaultMonthEnd());
  };

  const formatPdfAmount = (n) => {
    if (n == null) return "—";
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
        ["ID", "Trans ID", "Date", "Txn Dated Deb", "Txn Posted Date", "Cheq No", "Description", "Debit", "Credit", "Status", "Invoice No", "Balance"],
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
        displayInvoiceStatus(row),
        row.invoice_number || "-",
        formatPdfAmount(displayBalance(row)),
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 24 },
        2: { cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 20 },
        5: { cellWidth: 18 },
        6: { cellWidth: 32 },
        7: { cellWidth: 16 },
        8: { cellWidth: 16 },
        9: { cellWidth: 18 },
        10: { cellWidth: 26 },
        11: { cellWidth: 22 },
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

      if (data.warning) {
        toast(`⚠ ${data.warning}`, { icon: "⚠️", duration: 6000 });
      }
      if (data.skipped > 0 && data.skipped_rows?.length > 0) {
        setSkippedRows(data.skipped_rows);
        setSelectedSkipped(new Set(data.skipped_rows.map((_, i) => i).filter((i) => data.skipped_rows[i].rowData)));
        setShowSkippedModal(true);
        toast.success(`Inserted: ${data.inserted} | Skipped: ${data.skipped} — check skipped records`);
      } else {
        toast.success(`Imported: ${data.inserted} inserted${data.skipped > 0 ? `, ${data.skipped} skipped` : ""}`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleForceImport = async () => {
    const rowsToImport = skippedRows
      .filter((_, i) => selectedSkipped.has(i))
      .map((row, i) => {
        if (!selectedSkipped.has(i)) return null;
        // Duplicate row — use original rowData
        if (row.rowData) return row.rowData;
        // Parse-error row — use manually edited data
        const ed = editData[i];
        if (ed && ed.trans_id && ed.date && ed.amount && ed.type) return ed;
        return null;
      })
      .filter(Boolean);

    if (rowsToImport.length === 0) {
      toast.error("Select rows to import. For parse-error rows, fill in the required fields first.");
      return;
    }

    setForceImporting(true);
    setForceResult(null);
    try {
      const res = await fetch("/api/statements/force-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rows: rowsToImport }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Force import failed");
      setForceResult(data);
      if (data.errors?.length === 0) {
        toast.success(`Done: ${data.inserted} inserted, ${data.updated} updated — date filter reset to show all`);
        // Reset date filter so imported records (possibly old dates) are visible
        setDateFrom("");
        setDateTo("");
      } else {
        toast.error(`${data.errors.length} row(s) failed — see details`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err.message || "Force import failed");
    } finally {
      setForceImporting(false);
    }
  };

  const closeSkippedModal = () => {
    setShowSkippedModal(false);
    setSkippedRows([]);
    setSelectedSkipped(new Set());
    setEditData({});
    setForceResult(null);
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

  const filteredUnsettled = filteredRows.filter((r) => !isSettledRow(r)).length;
  const filteredSettled = filteredRows.filter((r) => isSettledRow(r)).length;

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
        <div className="relative w-full sm:w-auto sm:min-w-[min(100%,20rem)] md:min-w-[24rem] lg:min-w-[28rem] sm:max-w-xl">
          <label htmlFor="statements-search" className="sr-only">
            Search statements by Trans ID, expense ID, description, cheque number, or amount
          </label>
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 pointer-events-none" />
          <input
            id="statements-search"
            type="search"
            enterKeyHint="search"
            placeholder="Trans ID, Invoice No, description, amount…"
            title="Search by Trans ID, Invoice Number, description, cheque no, or amount. Digits only = expense ID."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 outline-none"
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
              <th className="p-3">Invoice No</th>
              <th className="p-3">Purchase IDs</th>
              <th
                onClick={() => handleSort("balance")}
                className="p-3 cursor-pointer select-none"
                title="Bank closing balance from file when imported; otherwise calculated on filtered rows"
              >
                Balance<SortIcon column="balance" />
              </th>
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
                    {displayInvoiceStatus(row) ? (
                      <span className={
                        displayInvoiceStatus(row) === "Settled"
                          ? "px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700"
                          : displayInvoiceStatus(row) === "Partial Paid"
                          ? "px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700"
                          : "px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"
                      }>
                        {displayInvoiceStatus(row)}
                      </span>
                    ) : (
                      <span className={isSettledRow(row) ? "text-green-600 font-medium text-sm" : "text-amber-600 font-medium text-sm"}>
                        {isSettledRow(row) ? "Settled" : "Unsettled"}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {row.invoice_number ? (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-mono rounded whitespace-nowrap">
                        {row.invoice_number}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {(() => {
                      const ids = getLinkedPurchaseIds(row);
                      if (!ids.length) return <span className="text-gray-300 text-xs">—</span>;
                      return (
                        <span className="text-xs font-mono text-slate-700">
                          {ids.map((x) => `#${x}`).join(", ")}
                        </span>
                      );
                    })()}
                  </td>
                  <td
                    className="p-3 font-medium"
                    title={
                      row.closing_balance != null
                        ? "Closing balance from bank file (import)"
                        : "No closing balance provided in bank file"
                    }
                  >
                    {displayBalance(row) != null ? `₹${displayBalance(row).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                  </td>
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
                <td colSpan="14" className="p-4 text-center text-gray-500">
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
            <div>
              <strong>Status:</strong>{" "}
              {displayInvoiceStatus(row) ? (
                <span className={
                  displayInvoiceStatus(row) === "Settled"
                    ? "px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700"
                    : displayInvoiceStatus(row) === "Partial Paid"
                    ? "px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700"
                    : "px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"
                }>
                  {displayInvoiceStatus(row)}
                </span>
              ) : (
                <span className={isSettledRow(row) ? "text-green-600" : "text-amber-600"}>
                  {isSettledRow(row) ? "Settled" : "Unsettled"}
                </span>
              )}
            </div>
            <div>
              <strong>Invoice No:</strong>{" "}
              {row.invoice_number ? (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-mono rounded">
                  {row.invoice_number}
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </div>
            <div>
              <strong>Purchase IDs:</strong>{" "}
              {(() => {
                const raw = row.linked_purchase_ids;
                let ids = [];
                if (raw != null && String(raw).trim() !== "") {
                  try {
                    const parsed = JSON.parse(String(raw));
                    if (Array.isArray(parsed)) {
                      ids = parsed
                        .map((x) => Number(x))
                        .filter((x) => Number.isFinite(x) && x > 0);
                    }
                  } catch {
                    ids = String(raw)
                      .split(",")
                      .map((x) => Number(String(x).trim()))
                      .filter((x) => Number.isFinite(x) && x > 0);
                  }
                }
                if (!ids.length) return <span className="text-gray-400">—</span>;
                return (
                  <span className="text-xs font-mono text-slate-700">
                    {ids.map((x) => `#${x}`).join(", ")}
                  </span>
                );
              })()}
            </div>
            <div>
              <strong>Balance:</strong>{" "}
              <span className="font-semibold">
                {displayBalance(row) != null ? `₹${displayBalance(row).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
              </span>
            </div>
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

      {/* Skipped Rows Modal */}
      {showSkippedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-orange-600 rounded-t-lg px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Skipped Records ({skippedRows.length})
                </h3>
                <p className="text-orange-100 text-xs mt-0.5">
                  <span className="font-medium">Orange</span> = Duplicate (select to overwrite) &nbsp;|&nbsp;
                  <span className="font-medium">Red</span> = Parse error — fill in missing fields to import
                </p>
              </div>
              <button type="button" onClick={closeSkippedModal} className="p-1 hover:bg-orange-700 rounded text-white">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {/* Force import result banner */}
              {forceResult && (
                <div className={`rounded p-3 text-sm border ${forceResult.errors?.length > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                  <p className="font-semibold mb-1">
                    {forceResult.errors?.length === 0
                      ? "✓ Force import complete — date filter has been reset, search by Trans ID to find your record"
                      : "⚠ Force import finished with errors"}
                  </p>
                  <div className="flex gap-4 flex-wrap">
                    <span className="text-green-700">✓ Inserted: <strong>{forceResult.inserted}</strong></span>
                    <span className="text-blue-700">↻ Updated: <strong>{forceResult.updated}</strong></span>
                    {forceResult.errors?.length > 0 && (
                      <span className="text-red-700">✕ Failed: <strong>{forceResult.errors.length}</strong></span>
                    )}
                  </div>
                  {forceResult.errors?.length > 0 && (
                    <ul className="mt-2 text-xs text-red-600 list-disc list-inside">
                      {forceResult.errors.map((e, i) => (
                        <li key={i}><span className="font-mono">{e.trans_id}</span>: {e.reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Select all duplicates */}
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={
                      skippedRows.filter((r) => r.rowData).length > 0 &&
                      skippedRows.every((r, i) => !r.rowData || selectedSkipped.has(i))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSkipped(new Set(skippedRows.map((_, i) => i).filter((i) => skippedRows[i].rowData)));
                      } else {
                        setSelectedSkipped(new Set());
                      }
                    }}
                    className="w-4 h-4"
                  />
                  Select all duplicates ({skippedRows.filter((r) => r.rowData).length})
                </label>
                <span className="text-gray-400 text-xs">{selectedSkipped.size} selected for import</span>
              </div>

              {/* Rows */}
              <div className="space-y-2">
                {skippedRows.map((row, idx) => {
                  const isDuplicate = !!row.rowData;
                  const isSelected = selectedSkipped.has(idx);
                  const ed = editData[idx] || {};
                  const isEditComplete = !isDuplicate && ed.trans_id && ed.date && ed.amount && ed.type;
                  const isEditSelected = selectedSkipped.has(idx);

                  return (
                    <div
                      key={idx}
                      className={`border rounded p-3 text-sm transition-colors ${
                        isDuplicate
                          ? isSelected ? "border-orange-400 bg-orange-50" : "border-orange-200 bg-orange-50/30"
                          : isEditSelected ? "border-blue-400 bg-blue-50" : "border-red-200 bg-red-50/30"
                      }`}
                    >
                      {/* Row header */}
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <input
                          type="checkbox"
                          checked={isDuplicate ? isSelected : isEditSelected && isEditComplete}
                          disabled={!isDuplicate && !isEditComplete}
                          onChange={() => {
                            setSelectedSkipped((prev) => {
                              const next = new Set(prev);
                              if (next.has(idx)) next.delete(idx);
                              else next.add(idx);
                              return next;
                            });
                          }}
                          className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                          title={!isDuplicate && !isEditComplete ? "Fill in required fields below to enable" : ""}
                        />
                        <span className="font-mono font-medium">{row.trans_id || "-"}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          isDuplicate ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                        }`}>
                          {row.reason}
                        </span>
                        {!isDuplicate && (
                          <span className="text-xs text-blue-600 font-medium">
                            ← Fill required fields below to import
                          </span>
                        )}
                      </div>

                      {/* Existing data preview / edit form */}
                      {isDuplicate ? (
                        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                          <span>Date: <strong>{row.date ? new Date(row.date).toLocaleDateString("en-IN") : "-"}</strong></span>
                          <span>Type: <strong className={row.type === "Credit" ? "text-green-700" : "text-red-700"}>{row.type || "-"}</strong></span>
                          <span>Amount: <strong>₹{Number(row.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
                          <span className="max-w-xs truncate">Desc: <strong>{row.description || "-"}</strong></span>
                        </div>
                      ) : (
                        /* Parse-error inline edit form */
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                          <div>
                            <label className="block text-xs text-gray-500 mb-0.5">Trans ID *</label>
                            <input
                              type="text"
                              className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400"
                              value={ed.trans_id ?? row.trans_id ?? ""}
                              onChange={(e) => setEditData((p) => ({ ...p, [idx]: { ...p[idx], trans_id: e.target.value } }))}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-0.5">Date *</label>
                            <input
                              type="date"
                              className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400"
                              value={ed.date ?? ""}
                              onChange={(e) => setEditData((p) => ({ ...p, [idx]: { ...p[idx], date: e.target.value } }))}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-0.5">Type *</label>
                            <select
                              className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400"
                              value={ed.type ?? "Credit"}
                              onChange={(e) => setEditData((p) => ({ ...p, [idx]: { ...p[idx], type: e.target.value } }))}
                            >
                              <option value="Credit">Credit</option>
                              <option value="Debit">Debit</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-0.5">Amount *</label>
                            <input
                              type="number"
                              min="0"
                              className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400"
                              value={ed.amount ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditData((p) => {
                                  const updated = { ...p[idx], amount: val };
                                  // auto-select once complete
                                  if (updated.trans_id && updated.date && updated.amount && updated.type) {
                                    setSelectedSkipped((prev) => new Set([...prev, idx]));
                                  }
                                  return { ...p, [idx]: updated };
                                });
                              }}
                            />
                          </div>
                          <div className="sm:col-span-4">
                            <label className="block text-xs text-gray-500 mb-0.5">Description</label>
                            <input
                              type="text"
                              className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400"
                              value={ed.description ?? row.description ?? ""}
                              onChange={(e) => setEditData((p) => ({ ...p, [idx]: { ...p[idx], description: e.target.value } }))}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t p-4 flex justify-between items-center bg-gray-50 rounded-b-lg">
              <p className="text-xs text-gray-500">
                Total skipped: <strong>{skippedRows.length}</strong> &nbsp;|&nbsp; Selected: <strong>{selectedSkipped.size}</strong>
              </p>
              <div className="flex gap-3">
                <button onClick={closeSkippedModal} className="px-4 py-2 border rounded text-sm hover:bg-gray-100">
                  Close
                </button>
                <button
                  onClick={handleForceImport}
                  disabled={forceImporting || selectedSkipped.size === 0}
                  className="px-5 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {forceImporting ? "Importing..." : `Force Import (${selectedSkipped.size})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                      <p><span className="font-medium">Transaction ID:</span> <span className="font-mono text-xs">{expense.transaction_id || "-"}</span></p>
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
