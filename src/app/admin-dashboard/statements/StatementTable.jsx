"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import { useState, useEffect, useRef, useMemo } from "react";
import toast from "react-hot-toast";
import { Eye, Pencil, X, Upload, Download, FileSpreadsheet, Search, Trash2, Building2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";

export default function StatementTable({ rows }) {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [linkedTypeFilter, setLinkedTypeFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "desc" });
  const [modalId, setModalId] = useState(null);
  const [expense, setExpense] = useState(null);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [fixingStatus, setFixingStatus] = useState(false);
  const [skippedRows, setSkippedRows] = useState([]);
  const [showSkippedModal, setShowSkippedModal] = useState(false);
  const [selectedSkipped, setSelectedSkipped] = useState(new Set());
  const [forceImporting, setForceImporting] = useState(false);
  const [editData, setEditData] = useState({});   // idx → {trans_id,date,type,amount,description}
  const [forceResult, setForceResult] = useState(null); // {inserted,updated,errors}
  /** When search is numeric expense id: expense.transaction_id for trans_id match (unsettled rows). */
  const [expenseTxnForIdSearch, setExpenseTxnForIdSearch] = useState(null);
  const [expenseIdResolved, setExpenseIdResolved] = useState(null);
  const [purchaseTypeByLegacyId, setPurchaseTypeByLegacyId] = useState({});

  useEffect(() => {
    const statusFromCard = searchParams.get("status");
    const fromCard = searchParams.get("fromCard");
    if (statusFromCard === "Settled" || statusFromCard === "Unsettled") {
      setStatusFilter(statusFromCard);
    }
    if (fromCard === "1") {
      setSearchQuery("");
      setLinkedTypeFilter("");
      setDateFrom("");
      setDateTo("");
    }
  }, [searchParams]);

  // --- Import modal state ---
  const [showImportModal, setShowImportModal] = useState(false);
  const [banks, setBanks] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [importFile, setImportFile] = useState(null);
  const importFileRef = useRef(null);

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

  const getLinkedPurchaseRefs = (row) => {
    const raw = row?.linked_purchase_ids;
    if (raw == null || String(raw).trim() === "") return [];
    let arr = null;
    try {
      const parsed = JSON.parse(String(raw));
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      arr = String(raw).split(",");
    }
    const out = [];
    for (const v of arr) {
      if (v == null) continue;
      if (typeof v === "number" && Number.isFinite(v) && v > 0) {
        const id = Math.trunc(v);
        out.push({ prefix: purchaseTypeByLegacyId[id] || "PP", id });
        continue;
      }
      const s = String(v).trim().toUpperCase();
      if (!s) continue;
      if (/^IP\d+$/.test(s)) {
        // Invoice-linked token — treat as settled
        const id = Number(s.slice(2));
        if (Number.isFinite(id) && id > 0) out.push({ prefix: "IP", id });
        continue;
      }
      if (/^(PP|PS|SP)\d+$/.test(s)) {
        const prefix = s.startsWith("SP") ? "PS" : s.slice(0, 2);
        const id = Number(s.slice(2));
        if (Number.isFinite(id) && id > 0) out.push({ prefix, id });
        continue;
      }
      if (/^\d+$/.test(s)) {
        const id = Number(s);
        if (Number.isFinite(id) && id > 0) out.push({ prefix: purchaseTypeByLegacyId[id] || "PP", id });
        continue;
      }
    }
    return out;
  };

  const isSettledRow = (row) => {
    const linked = getLinkedPurchaseRefs(row);
    const inv = String(row?.invoice_status ?? "").trim();
    if (inv === "Settled") return true;
    if (row?.client_expense_id) return true;
    if (row?.dd_id) return true;
    if (row?.linked_module_id && row?.linked_module_type === 'Assets') return true;
    if (linked.length > 0) return true; // includes IP-prefixed invoice tokens
    if (row?.invoice_number != null && String(row.invoice_number).trim() !== "") return true;
    if (row?.failed_transaction_id != null && String(row.failed_transaction_id).trim() !== "") return true;
    if (row?.cancelled_transaction_id != null && String(row.cancelled_transaction_id).trim() !== "") return true;
    return false;
  };

  const displayInvoiceStatus = (row) => {
    const linked = getLinkedPurchaseRefs(row);
    const inv = row?.invoice_status != null ? String(row.invoice_status).trim() : "";
    if (row?.failed_transaction_id != null && String(row.failed_transaction_id).trim() !== "") return "Failed";
    if (row?.cancelled_transaction_id != null && String(row.cancelled_transaction_id).trim() !== "") return "Cancelled";
    if (linked.length > 0) return "Settled"; // includes IP-prefixed invoice tokens
    if (row?.client_expense_id) return "Settled";
    if (row?.dd_id) return "Settled";
    if (row?.linked_module_id && row?.linked_module_type === 'Assets') return "Settled";
    if (inv) return inv;
    if (row?.invoice_number != null && String(row.invoice_number).trim() !== "") return "Settled";
    return "Unsettled";
  };

  useEffect(() => {
    const legacy = new Set();
    for (const row of rows || []) {
      const raw = row?.linked_purchase_ids;
      if (raw == null || String(raw).trim() === "") continue;
      let arr = null;
      try {
        const parsed = JSON.parse(String(raw));
        if (Array.isArray(parsed)) arr = parsed;
      } catch {
        arr = String(raw).split(",");
      }
      for (const v of arr) {
        if (v == null) continue;
        if (typeof v === "number" && Number.isFinite(v) && v > 0) {
          legacy.add(Math.trunc(v));
          continue;
        }
        const s = String(v).trim().toUpperCase();
        if (!s) continue;
        if (/^(PP|PS|SP)\d+$/.test(s)) continue;
        if (/^\d+$/.test(s)) legacy.add(Number(s));
      }
    }
    if (legacy.size === 0) {
      setPurchaseTypeByLegacyId({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [prodRes, spareRes] = await Promise.all([
          fetch("/api/stock-request", { credentials: "include" }).catch(() => null),
          fetch("/api/spare/stock-request", { credentials: "include" }).catch(() => null),
        ]);
        const prodData = prodRes && prodRes.ok ? await prodRes.json().catch(() => []) : [];
        const spareData = spareRes && spareRes.ok ? await spareRes.json().catch(() => []) : [];
        const prodIds = new Set((Array.isArray(prodData) ? prodData : []).map((p) => Number(p?.id)).filter((n) => Number.isFinite(n) && n > 0));
        const spareIds = new Set((Array.isArray(spareData) ? spareData : []).map((p) => Number(p?.id)).filter((n) => Number.isFinite(n) && n > 0));
        const map = {};
        for (const id of legacy) {
          if (spareIds.has(id) && !prodIds.has(id)) map[id] = "PS";
          else map[id] = "PP";
        }
        if (!cancelled) setPurchaseTypeByLegacyId(map);
      } catch {
        if (!cancelled) setPurchaseTypeByLegacyId({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rows]);

  // Fetch banks for import modal
  useEffect(() => {
    let cancelled = false;
    fetch("/api/bank-masters", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setBanks(data.banks || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const filteredRows = useMemo(() => {    return rows.filter((row) => {
      const qRaw = searchQuery.trim();
      const q = qRaw.toLowerCase();
      const isNumericSearch = /^\d+$/.test(qRaw);

      // Special case: If searching for a numeric Purchase ID, show ALL matches bypassing date/status filters
      if (isNumericSearch) {
        const refs = getLinkedPurchaseRefs(row);
        const isPurchaseMatch = refs.some((ref) => String(ref.id) === qRaw);
        if (isPurchaseMatch) return true;
      }

      if (statusFilter) {
        const settled = isSettledRow(row);
        if (statusFilter === "Settled" && !settled) return false;
        if (statusFilter === "Unsettled" && settled) return false;
      }

      if (qRaw) {
        const matchesExpenseLinked =
          isNumericSearch &&
          row.client_expense_id != null &&
          String(row.client_expense_id) === qRaw;
        const rowTransNorm = String(row.trans_id || "").trim().toLowerCase();
        const expenseTxnNorm = expenseTxnForIdSearch ? expenseTxnForIdSearch.toLowerCase() : "";
        const matchesExpenseByTransId =
          isNumericSearch &&
          expenseIdResolved === qRaw &&
          expenseTxnNorm !== "" &&
          rowTransNorm === expenseTxnNorm;

        // Digits-only = expense ID: only linked row OR statement.trans_id === that expense's transaction_id.
        if (isNumericSearch) {
          if (!matchesExpenseLinked && !matchesExpenseByTransId) return false;
        } else {
          const transId = (row.trans_id || "").toLowerCase();
          const desc = (row.description || "").toLowerCase();
          const cheqNo = (row.cheq_no || "").toLowerCase();
          const amount = String(row.amount || "");
          const invoiceNo = (row.invoice_number || "").toLowerCase();
          const linked = (row.linked_purchase_ids || "").toLowerCase();
          if (
            !transId.includes(q) &&
            !desc.includes(q) &&
            !cheqNo.includes(q) &&
            !amount.includes(q) &&
            !invoiceNo.includes(q) &&
            !linked.includes(q)
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

      // Linked type filter
      if (linkedTypeFilter) {
        const hasInvoice = !!String(row.invoice_number || "").trim();
        const hasPurchases = getLinkedPurchaseRefs(row).filter(x => x.prefix !== "IP").length > 0;
        const hasDD = row.dd_id != null && String(row.dd_id).trim() !== "";
        const hasExpense = row.client_expense_id != null && String(row.client_expense_id).trim() !== "";
        const hasAssets = row.linked_module_type === 'Assets' && row.linked_module_id != null;
        if (linkedTypeFilter === "Invoice" && !hasInvoice) return false;
        if (linkedTypeFilter === "Purchases" && !hasPurchases) return false;
        if (linkedTypeFilter === "DD" && !hasDD) return false;
        if (linkedTypeFilter === "Expense" && !hasExpense) return false;
        if (linkedTypeFilter === "Assets" && !hasAssets) return false;
      }

      return true;
    });
  }, [rows, statusFilter, searchQuery, dateFrom, dateTo, linkedTypeFilter, expenseTxnForIdSearch, expenseIdResolved]);

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
    setLinkedTypeFilter("");
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
        ["ID", "Trans ID", "Date", "Txn Dated Deb", "Txn Posted Date", "Cheq No", "Description", "Debit", "Credit", "Status", "Invoice No", "Purchase IDs", "DD ID", "Expense ID", "Balance"],
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
        getLinkedPurchaseRefs(row).map(x => `${x.prefix}${x.id}`).join(", ") || "-",
        row.dd_id ? `DD#${row.dd_id}` : "-",
        row.client_expense_id ? `EXP#${row.client_expense_id}` : "-",
        row.linked_module_id && row.linked_module_type ? (
          row.linked_module_type === 'Assets' ? `ASS#${row.linked_module_id}` :
          row.linked_module_type === 'Invoice' ? `INV#${row.linked_module_id}` :
          row.linked_module_type === 'Purchases' ? `PUR#${row.linked_module_id}` :
          row.linked_module_type === 'DD' ? `DD#${row.linked_module_id}` :
          row.linked_module_type === 'Expense' ? `EXP#${row.linked_module_id}` : "-"
        ) : "-",
        formatPdfAmount(displayBalance(row)),
      ]),
      styles: { fontSize: 6 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 20 },
        2: { cellWidth: 18 },
        3: { cellWidth: 18 },
        4: { cellWidth: 18 },
        5: { cellWidth: 15 },
        6: { cellWidth: 28 },
        7: { cellWidth: 14 },
        8: { cellWidth: 14 },
        9: { cellWidth: 15 },
        10: { cellWidth: 22 },
        11: { cellWidth: 22 },
        12: { cellWidth: 15 },
        13: { cellWidth: 18 },
        14: { cellWidth: 20 },
      },
      margin: { left: 14, right: 14 },
    });
    doc.save(`statements_${dayjs().format("YYYY-MM-DD")}.pdf`);
    toast.success("PDF exported");
  };

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Statements");

      // Define columns
      worksheet.columns = [
        { header: "ID", key: "id", width: 10 },
        { header: "Trans ID", key: "trans_id", width: 18 },
        { header: "Date", key: "date", width: 12 },
        { header: "Txn Dated Deb", key: "txn_dated_deb", width: 14 },
        { header: "Txn Posted Date", key: "txn_posted_date", width: 16 },
        { header: "Cheq No", key: "cheq_no", width: 12 },
        { header: "Description", key: "description", width: 25 },
        { header: "Debit", key: "debit", width: 12 },
        { header: "Credit", key: "credit", width: 12 },
        { header: "Status", key: "status", width: 12 },
        { header: "Invoice No", key: "invoice_number", width: 14 },
        { header: "Purchase IDs", key: "purchase_ids", width: 16 },
        { header: "DD ID", key: "dd_id", width: 10 },
        { header: "Expense ID", key: "expense_id", width: 12 },
        { header: "Bank Account", key: "account_number", width: 16 },
        { header: "Balance", key: "balance", width: 14 },
      ];

      // Style header row
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF3B82F6" },
      };
      worksheet.getRow(1).font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
      };

      // Add data rows
      sortedRows.forEach((row) => {
        worksheet.addRow({
          id: row.id,
          trans_id: row.trans_id || "-",
          date: row.date ? dayjs(row.date).format("DD MMM YYYY") : "-",
          txn_dated_deb: row.txn_dated_deb && row.txn_dated_deb !== "0000-00-00" ? dayjs(row.txn_dated_deb).format("DD MMM YYYY") : "-",
          txn_posted_date: row.txn_posted_date && row.txn_posted_date !== "0000-00-00" ? dayjs(row.txn_posted_date).format("DD MMM YYYY") : "-",
          cheq_no: row.cheq_no || "-",
          description: row.description || "-",
          debit: row.type === "Debit" ? formatPdfAmount(row.amount) : "-",
          credit: row.type === "Credit" ? formatPdfAmount(row.amount) : "-",
          status: displayInvoiceStatus(row),
          invoice_number: row.invoice_number || "-",
          purchase_ids: getLinkedPurchaseRefs(row).map(x => `${x.prefix}${x.id}`).join(", ") || "-",
          dd_id: row.dd_id ? `DD#${row.dd_id}` : "-",
          expense_id: row.client_expense_id ? `EXP#${row.client_expense_id}` : "-",
          account_number: row.account_number || "-",
          balance: displayBalance(row) != null ? formatPdfAmount(displayBalance(row)) : "-",
        });
      });

      // Center align numeric columns
      worksheet.columns.forEach((col) => {
        if (["id", "debit", "credit", "balance"].includes(col.key)) {
          worksheet.getColumn(col.key).alignment = { horizontal: "right" };
        }
      });

      // Generate and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `statements_${dayjs().format("YYYY-MM-DD")}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success("Excel exported");
    } catch (err) {
      toast.error("Failed to export Excel: " + (err.message || "Unknown error"));
    }
  };

  // Opens the import modal
  const openImportModal = () => {
    setSelectedBankId("");
    setImportFile(null);
    if (importFileRef.current) importFileRef.current.value = "";
    setShowImportModal(true);
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setSelectedBankId("");
    setImportFile(null);
    if (importFileRef.current) importFileRef.current.value = "";
  };

  const handleImport = async () => {
    if (!selectedBankId) {
      toast.error("Please select a bank before importing");
      return;
    }
    if (!importFile) {
      toast.error("Please choose a CSV or Excel file");
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("bank_id", selectedBankId);
      const res = await fetch("/api/statements/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      closeImportModal();

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

  const handleFixInvoiceStatus = async () => {
    if (!window.confirm("Yeh action DB mein saari linked statements ka invoice_status 'Settled' kar dega. Continue?")) return;
    setFixingStatus(true);
    try {
      const res = await fetch("/api/statements/fix-invoice-status", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fix failed");
      toast.success(data.message || "Fix complete");
      router.refresh();
    } catch (err) {
      toast.error(err.message || "Fix failed");
    } finally {
      setFixingStatus(false);
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
    
    // Fetch the statement row first
    fetch(`/api/statements/${modalId}`)
      .then((r) => r.json())
      .then(async (statement) => {
        if (statement?.error) throw new Error(statement.error);
        
        const linkedData = { ...statement };
        
        // Fetch linked expense if exists
        if (statement.client_expense_id) {
          try {
            const expRes = await fetch(`/api/client-expenses/${statement.client_expense_id}`);
            const expData = await expRes.json();
            if (expRes.ok && !expData.error) {
              linkedData.expense = expData;
            }
          } catch (e) {
            console.error("Failed to fetch expense:", e);
          }
        }
        
        // Fetch linked invoice if exists
        if (statement.invoice_number) {
          try {
            const invRes = await fetch(`/api/invoice-list?search=${encodeURIComponent(statement.invoice_number)}&limit=5`);
            const invData = await invRes.json();
            // API returns { data: [...] } or { invoices: [...] }
            const invList = invData.data || invData.invoices || [];
            const matched = invList.find(i =>
              String(i.invoice_number || "").trim() === String(statement.invoice_number).trim()
            ) || invList[0];
            if (invRes.ok && matched) {
              linkedData.invoice = matched;
            }
          } catch (e) {
            console.error("Failed to fetch invoice:", e);
          }
        }
        
        // Fetch linked DD if exists
        if (statement.dd_id) {
          try {
            const ddRes = await fetch(`/api/dd-management?search=${statement.dd_id}`, { credentials: "include" });
            const ddData = await ddRes.json();
            const ddList = ddData.data || ddData.records || (Array.isArray(ddData) ? ddData : []);
            const matched = ddList.find(d => Number(d.id) === Number(statement.dd_id)) || ddList[0];
            if (ddRes.ok && matched) {
              linkedData.dd = matched;
            }
          } catch (e) {
            console.error("Failed to fetch DD:", e);
          }
        }
        
        // Fetch linked purchases if exists
        if (statement.linked_purchase_ids) {
          try {
            let tokens = [];
            try { tokens = JSON.parse(String(statement.linked_purchase_ids)); } catch { tokens = String(statement.linked_purchase_ids).split(",").map(s => s.trim()); }
            const hasInvoice = !!String(statement.invoice_number || "").trim();
            const purchaseItems = [];
            for (const token of tokens) {
              const t = String(token).trim();
              const match = t.match(/^(IP|PP|PS)(\d+)$/i);
              if (!match) continue;
              const prefix = match[1].toUpperCase();
              // Skip IP-prefixed tokens when invoice_number already covers them
              if (prefix === "IP" && hasInvoice) continue;
              const pId = match[2];
              const apiUrl = prefix === "PS"
                ? `/api/spare/stock-request?id=${pId}`
                : `/api/stock-request?id=${pId}`;
              try {
                const res = await fetch(apiUrl);
                const data = await res.json();
                const item = Array.isArray(data) ? data[0] : (data?.requests?.[0] || data?.request || data);
                if (item && !item.error) {
                  purchaseItems.push({ token: t, prefix, id: pId, ...item });
                } else {
                  purchaseItems.push({ token: t, prefix, id: pId });
                }
              } catch {
                purchaseItems.push({ token: t, prefix, id: pId });
              }
            }
            if (purchaseItems.length > 0) linkedData.purchases = purchaseItems;
          } catch (e) {
            console.error("Failed to fetch purchases:", e);
          }
        }
        
        // Fetch linked asset if exists
        if (statement.linked_module_type === 'Assets' && statement.linked_module_id) {
          try {
            const assetRes = await fetch(`/api/assets-management/${statement.linked_module_id}`);
            const assetData = await assetRes.json();
            if (assetRes.ok && !assetData.error) {
              linkedData.asset = assetData;
            }
          } catch (e) {
            console.error("Failed to fetch asset:", e);
          }
        }
        
        return linkedData;
      })
      .then((linkedData) => {
        setExpense(linkedData);
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
            Search anything in statements table
          </label>
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 pointer-events-none" />
          <input
            id="statements-search"
            type="search"
            enterKeyHint="search"
            placeholder="Search across all statement fields..."
            title="Search anything from the statements table"
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
        <select
          value={linkedTypeFilter}
          onChange={(e) => setLinkedTypeFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg w-full sm:w-44 text-sm"
          title="Filter by linked type"
        >
          <option value="">All Types</option>
          <option value="Invoice">Invoice</option>
          <option value="Purchases">Purchases</option>
          <option value="DD">DD</option>
          <option value="Expense">Expense</option>
          <option value="Assets">Assets</option>
        </select>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-300 rounded-lg text-sm cursor-pointer w-full sm:w-auto"
        >
          Reset
        </button>
        <div className="flex flex-wrap gap-2 ml-auto">
          <button
            type="button"
            onClick={openImportModal}
            disabled={importing}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <Upload size={16} />
            {importing ? "Importing..." : "Import (CSV/Excel)"}
          </button>          <button
            type="button"
            onClick={handleExportPDF}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <Download size={16} />
            Export PDF
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
            title="Download filtered data as Excel"
          >
            <Download size={16} />
            Export Excel
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
          <button
            type="button"
            onClick={handleDeleteAll}
            disabled={deletingAll || rows.length === 0}
            className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete all statements"
          >
            <Trash2 size={16} />
            {deletingAll ? "Deleting..." : "Delete All"}
          </button>
          {/* <button
            type="button"
            onClick={handleFixInvoiceStatus}
            disabled={fixingStatus}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Fix invoice_status for already-linked statements that still show Unsettled"
          >
            {fixingStatus ? "Fixing..." : "Fix Settled Status"}
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
              <th className="p-3">Bank</th>
              <th className="p-3">Invoice, Purchases, DD, Expense</th>
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
                          : displayInvoiceStatus(row) === "Failed"
                          ? "px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"
                          : displayInvoiceStatus(row) === "Cancelled"
                          ? "px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700"
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
                    {row.account_number ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-800 text-xs font-medium rounded-full whitespace-nowrap">
                        <Building2 size={11} />
                        {row.account_number}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="space-y-1">
                      {row.invoice_number && (
                        <div>
                          <span 
                            className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-mono rounded whitespace-nowrap"
                            title={row.invoice_number}
                          >
                            {row.invoice_number}
                          </span>
                        </div>
                      )}
                      {/* Show linked invoice IDs from linked_purchase_ids (IP prefix) */}
                      {(() => {
                        const raw = row?.linked_purchase_ids;
                        if (!raw) return null;
                        let arr = [];
                        try {
                          const parsed = JSON.parse(String(raw));
                          if (Array.isArray(parsed)) arr = parsed;
                        } catch {
                          arr = String(raw).split(",").map(s => s.trim()).filter(Boolean);
                        }
                        const invIds = arr
                          .map(v => String(v).trim().toUpperCase())
                          .filter(v => /^IP\d+$/.test(v))
                          .map(v => v.replace('IP', ''));
                        if (invIds.length === 0) return null;
                        return (
                          <div className="flex flex-wrap gap-1">
                            {invIds.map(id => (
                              <span key={id} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-mono rounded">
                                INV{id}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                      {(() => {
                        const refs = getLinkedPurchaseRefs(row);
                        if (refs.length > 0) {
                          // Hide IP-prefixed refs when an invoice_number already covers them (P299 is redundant when INV299 shown)
                          const hasInvoice = !!String(row.invoice_number || "").trim();
                          const visibleRefs = hasInvoice
                            ? refs.filter(x => x.prefix !== "IP")
                            : refs;
                          if (visibleRefs.length === 0) return null;
                          return (
                            <div>
                              <span className="text-xs font-mono text-slate-700">
                                {visibleRefs.map((x) => `P${x.id}`).join(", ")}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {row.dd_id && (
                        <div>
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded">
                            DD{row.dd_id}
                          </span>
                        </div>
                      )}
                      {row.client_expense_id && (
                        <div>
                          <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded">
                            EXP{row.client_expense_id}
                          </span>
                        </div>
                      )}
                      {!row.invoice_number && !getLinkedPurchaseRefs(row).length && !row.dd_id && !row.client_expense_id && !row.linked_module_id && (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                      {row.linked_module_id && row.linked_module_type && (
                        <div>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                            row.linked_module_type === 'Assets' ? 'bg-indigo-100 text-indigo-700' :
                            row.linked_module_type === 'Invoice' ? 'bg-blue-100 text-blue-700' :
                            row.linked_module_type === 'Purchases' ? 'bg-green-100 text-green-700' :
                            row.linked_module_type === 'DD' ? 'bg-purple-100 text-purple-700' :
                            row.linked_module_type === 'Expense' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {row.linked_module_type === 'Assets' ? `ASS${row.linked_module_id}` :
                             row.linked_module_type === 'Invoice' ? `INV${row.linked_module_id}` :
                             row.linked_module_type === 'Purchases' ? `PUR${row.linked_module_id}` :
                             row.linked_module_type === 'DD' ? `DD${row.linked_module_id}` :
                             row.linked_module_type === 'Expense' ? `EXP${row.linked_module_id}` : `${row.linked_module_type}${row.linked_module_id}`}
                          </span>
                        </div>
                      )}
                    </div>
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
                <td colSpan="16" className="p-4 text-center text-gray-500">
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
                    : displayInvoiceStatus(row) === "Failed"
                    ? "px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"
                    : displayInvoiceStatus(row) === "Cancelled"
                    ? "px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700"
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
              <strong>Linked Modules:</strong>{" "}
              <div className="space-y-1 mt-1">
                {row.invoice_number && (
                  <span className="block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-mono rounded w-fit">
                    {row.invoice_number}
                  </span>
                )}
                {/* Show linked invoice IDs from linked_purchase_ids (IP prefix) */}
                {(() => {
                  const raw = row?.linked_purchase_ids;
                  if (!raw) return null;
                  let arr = [];
                  try {
                    const parsed = JSON.parse(String(raw));
                    if (Array.isArray(parsed)) arr = parsed;
                  } catch {
                    arr = String(raw).split(",").map(s => s.trim()).filter(Boolean);
                  }
                  const invIds = arr
                    .map(v => String(v).trim().toUpperCase())
                    .filter(v => /^IP\d+$/.test(v))
                    .map(v => v.replace('IP', ''));
                  if (invIds.length === 0) return null;
                  return invIds.map(id => (
                    <span key={id} className="block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-mono rounded w-fit">
                      INV{id}
                    </span>
                  ));
                })()}
                {(() => {
                  const refs = getLinkedPurchaseRefs(row);
                  if (refs.length > 0) {
                    const hasInvoice = !!String(row.invoice_number || "").trim();
                    const visibleRefs = hasInvoice
                      ? refs.filter(x => x.prefix !== "IP")
                      : refs;
                    if (visibleRefs.length === 0) return null;
                    return (
                      <span className="block text-xs font-mono text-slate-700">
                        {visibleRefs.map((x) => `P${x.id}`).join(", ")}
                      </span>
                    );
                  }
                  return null;
                })()}
                {row.dd_id && (
                  <span className="block px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded w-fit">
                    DD{row.dd_id}
                  </span>
                )}
                {row.client_expense_id && (
                  <span className="block px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded w-fit">
                    EXP#{row.client_expense_id}
                  </span>
                )}
                {row.linked_module_id && row.linked_module_type && (
                  <span className={`block px-2 py-0.5 rounded text-xs font-bold w-fit ${
                    row.linked_module_type === 'Assets' ? 'bg-indigo-100 text-indigo-700' :
                    row.linked_module_type === 'Invoice' ? 'bg-blue-100 text-blue-700' :
                    row.linked_module_type === 'Purchases' ? 'bg-green-100 text-green-700' :
                    row.linked_module_type === 'DD' ? 'bg-purple-100 text-purple-700' :
                    row.linked_module_type === 'Expense' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {row.linked_module_type === 'Assets' ? `ASS${row.linked_module_id}` :
                     row.linked_module_type === 'Invoice' ? `INV${row.linked_module_id}` :
                     row.linked_module_type === 'Purchases' ? `PUR${row.linked_module_id}` :
                     row.linked_module_type === 'DD' ? `DD${row.linked_module_id}` :
                     row.linked_module_type === 'Expense' ? `EXP${row.linked_module_id}` : `${row.linked_module_type}${row.linked_module_id}`}
                  </span>
                )}
                {!row.invoice_number && !getLinkedPurchaseRefs(row).length && !row.dd_id && !row.client_expense_id && !row.linked_module_id && (
                  <span className="text-gray-400">—</span>
                )}
              </div>
            </div>
            <div>
              <strong>Balance:</strong>{" "}
              <span className="font-semibold">
                {displayBalance(row) != null ? `₹${displayBalance(row).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
              </span>
            </div>
            <div>
              <strong>Bank Account:</strong>{" "}
              {row.account_number ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-800 text-xs font-medium rounded-full">
                  <Building2 size={11} />{row.account_number}
                </span>
              ) : <span className="text-gray-400 text-xs">—</span>}
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

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Upload size={18} className="text-emerald-600" />
                Import Bank Statement
              </h3>
              <button onClick={closeImportModal} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Bank selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Bank <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Select Bank —</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name}{b.account_number ? ` (A/C: ${b.account_number})` : ""}
                    </option>
                  ))}
                </select>
                {banks.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No banks found. <a href="/admin-dashboard/bank-masters" className="underline font-medium">Add a bank first →</a>
                  </p>
                )}
              </div>

              {/* File selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select CSV / Excel File <span className="text-red-500">*</span>
                </label>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 focus:outline-none"
                />
                {importFile && (
                  <p className="text-xs text-gray-500 mt-1 truncate">Selected: {importFile.name}</p>
                )}
              </div>

              {/* Info callout */}
              {selectedBankId && (() => {
                const bank = banks.find((b) => String(b.id) === String(selectedBankId));
                if (!bank) return null;
                return (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800 space-y-0.5">
                    <p className="font-semibold">{bank.bank_name}</p>
                    {bank.account_number && <p>Account: <span className="font-mono">{bank.account_number}</span></p>}
                    {bank.ifsc && <p>IFSC: <span className="font-mono">{bank.ifsc}</span></p>}
                    <p className="text-blue-600 mt-1">All imported rows will be tagged with this bank and account number automatically.</p>
                  </div>
                );
              })()}
            </div>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                onClick={closeImportModal}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !selectedBankId || !importFile}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload size={14} />
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Statement Linked Records View Modal */}
      {modalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Statement Linked Records</h3>
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
                <div className="space-y-6">

                  {/* Expense linked */}
                  {expense.client_expense_id && (
                    <div className="border rounded-lg p-4 bg-blue-50">
                      <h4 className="font-semibold text-blue-900 mb-3">💰 Client Expense</h4>
                      {expense.expense ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <p><span className="font-medium">ID:</span> {expense.expense.id}</p>
                          {expense.expense.expense_name && <p><span className="font-medium">Expense Name:</span> {expense.expense.expense_name}</p>}
                          {expense.expense.client_name && <p><span className="font-medium">Client:</span> {expense.expense.client_name}</p>}
                          {expense.expense.group_name && <p><span className="font-medium">Group:</span> {expense.expense.group_name}</p>}
                          {expense.expense.head && <p><span className="font-medium">Head:</span> {expense.expense.head}</p>}
                          {expense.expense.amount != null && <p><span className="font-medium">Amount:</span> ₹{Number(expense.expense.amount).toLocaleString("en-IN", {minimumFractionDigits:2})}</p>}
                          {expense.expense.hsn && <p><span className="font-medium">HSN:</span> {expense.expense.hsn}</p>}
                          <p><span className="font-medium">Tax applicable:</span> {expense.expense.tax_applicable ? "Yes" : "No"}</p>
                          {expense.expense.transaction_id && <p><span className="font-medium">Txn ID:</span> <span className="font-mono text-xs">{expense.expense.transaction_id}</span></p>}
                          {expense.expense.created_at && <p><span className="font-medium">Created:</span> {dayjs(expense.expense.created_at).format("DD MMM YYYY")}</p>}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-xs">Expense details not available</p>
                      )}
                    </div>
                  )}

                  {/* Invoice linked */}
                  {expense.invoice_number && (
                    <div className="border rounded-lg p-4 bg-green-50">
                      <h4 className="font-semibold text-green-900 mb-3">📄 Invoice</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <p><span className="font-medium">Invoice No:</span> <span className="font-mono">{expense.invoice_number}</span></p>
                        {expense.invoice ? (
                          <>
                            <p><span className="font-medium">Customer:</span> {expense.invoice.buyer_name || expense.invoice.customer_name || "-"}</p>
                            <p><span className="font-medium">Amount:</span> {expense.invoice.grand_total != null ? `₹${Number(expense.invoice.grand_total).toLocaleString("en-IN", {minimumFractionDigits:2})}` : "-"}</p>
                            <p><span className="font-medium">Date:</span> {expense.invoice.invoice_date ? dayjs(expense.invoice.invoice_date).format("DD MMM YYYY") : "-"}</p>
                            {expense.invoice.employee_name && <p><span className="font-medium">Employee:</span> {expense.invoice.employee_name}</p>}
                            {expense.invoice.gst_number && <p><span className="font-medium">GST:</span> {expense.invoice.gst_number}</p>}
                            {expense.invoice.cgst != null && Number(expense.invoice.cgst) > 0 && <p><span className="font-medium">CGST:</span> ₹{Number(expense.invoice.cgst).toLocaleString("en-IN", {minimumFractionDigits:2})}</p>}
                            {expense.invoice.sgst != null && Number(expense.invoice.sgst) > 0 && <p><span className="font-medium">SGST:</span> ₹{Number(expense.invoice.sgst).toLocaleString("en-IN", {minimumFractionDigits:2})}</p>}
                            {expense.invoice.igst != null && Number(expense.invoice.igst) > 0 && <p><span className="font-medium">IGST:</span> ₹{Number(expense.invoice.igst).toLocaleString("en-IN", {minimumFractionDigits:2})}</p>}
                          </>
                        ) : (
                          <p className="text-gray-400 text-xs col-span-2">Invoice details not available</p>
                        )}
                      </div>
                      {/* Invoice items */}
                      {expense.invoice?.items?.length > 0 && (
                        <div className="mt-3 border-t border-green-200 pt-3">
                          <p className="text-xs font-semibold text-green-800 mb-2">Items ({expense.invoice.items.length})</p>
                          <div className="space-y-1">
                            {expense.invoice.items.map((item, idx) => (
                              <div key={idx} className="text-xs text-gray-700 flex justify-between gap-2">
                                <span>{item.item_name || item.item_code || "-"}</span>
                                <span className="text-gray-500 shrink-0">
                                  {item.quantity && `Qty: ${item.quantity}`}
                                  {item.price_per_unit != null && ` · ₹${Number(item.price_per_unit).toLocaleString("en-IN")}`}
                                  {item.taxable_value != null && ` · ₹${Number(item.taxable_value).toLocaleString("en-IN")}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Purchases linked */}
                  {(() => {
                    const raw = expense.linked_purchase_ids;
                    if (!raw) return null;
                    let tokens = [];
                    try { tokens = JSON.parse(String(raw)); } catch { tokens = String(raw).split(",").map(s => s.trim()); }
                    const hasInvoice = !!String(expense.invoice_number || "").trim();
                    // Filter out IP-prefixed tokens when invoice covers them
                    const visibleTokens = hasInvoice
                      ? tokens.filter(t => !String(t).trim().toUpperCase().startsWith("IP"))
                      : tokens;
                    if (visibleTokens.length === 0) return null;
                    // Also filter purchases array
                    const visiblePurchases = (expense.purchases || []).filter(p => !(hasInvoice && String(p.prefix || "").toUpperCase() === "IP"));
                    return (
                      <div className="border rounded-lg p-4 bg-purple-50">
                        <h4 className="font-semibold text-purple-900 mb-3">🛒 Purchases</h4>
                        <div className="space-y-4">
                          {(expense.purchases || tokens.map(t => ({ token: String(t).trim() }))).map((pur, idx) => {
                            const token = pur.token || String(tokens[idx] || "").trim();
                            return (
                              <div key={idx} className={`text-sm ${idx > 0 ? "pt-3 border-t border-purple-200" : ""}`}>
                                <p className="font-semibold text-purple-800 mb-1 font-mono">{token}</p>
                                {pur.id && (pur.product_name || pur.product_code || pur.vendor_name || pur.total_amount != null) ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-700">
                                    {pur.product_name && <p><span className="font-medium">Product:</span> {pur.product_name}</p>}
                                    {pur.product_code && <p><span className="font-medium">Code:</span> {pur.product_code}</p>}
                                    {pur.vendor_name && <p><span className="font-medium">Vendor:</span> {pur.vendor_name}</p>}
                                    {pur.quantity != null && <p><span className="font-medium">Qty:</span> {pur.quantity}</p>}
                                    {pur.unit_price != null && <p><span className="font-medium">Unit Price:</span> ₹{Number(pur.unit_price).toLocaleString("en-IN", {minimumFractionDigits:2})}</p>}
                                    {pur.total_amount != null && <p><span className="font-medium">Total:</span> ₹{Number(pur.total_amount).toLocaleString("en-IN", {minimumFractionDigits:2})}</p>}
                                    {pur.status && <p><span className="font-medium">Status:</span> {pur.status}</p>}
                                    {pur.created_at && <p><span className="font-medium">Date:</span> {dayjs(pur.created_at).format("DD MMM YYYY")}</p>}
                                  </div>
                                ) : (
                                  <p className="text-gray-400 text-xs">Purchase details not available</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* DD linked */}
                  {expense.dd_id && (
                    <div className="border rounded-lg p-4 bg-orange-50">
                      <h4 className="font-semibold text-orange-900 mb-3">🏦 Demand Draft</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <p><span className="font-medium">DD ID:</span> {expense.dd_id}</p>
                        {expense.dd ? (
                          <>
                            {expense.dd.dd_number && <p><span className="font-medium">DD Number:</span> <span className="font-mono">{expense.dd.dd_number}</span></p>}
                            {expense.dd.bg_number && <p><span className="font-medium">BG Number:</span> <span className="font-mono">{expense.dd.bg_number}</span></p>}
                            {expense.dd.party_name && <p><span className="font-medium">Party:</span> {expense.dd.party_name}</p>}
                            {expense.dd.beneficiary_name && <p><span className="font-medium">Beneficiary:</span> {expense.dd.beneficiary_name}</p>}
                            {expense.dd.amount != null && <p><span className="font-medium">Amount:</span> ₹{Number(expense.dd.amount).toLocaleString("en-IN", {minimumFractionDigits:2})}</p>}
                            {expense.dd.bank_name && <p><span className="font-medium">Bank:</span> {expense.dd.bank_name}</p>}
                            {expense.dd.type && <p><span className="font-medium">Type:</span> {expense.dd.type}</p>}
                            {expense.dd.status && <p><span className="font-medium">Status:</span> {expense.dd.status}</p>}
                            {expense.dd.dd_date && <p><span className="font-medium">DD Date:</span> {dayjs(expense.dd.dd_date).format("DD MMM YYYY")}</p>}
                            {expense.dd.expiry_date && <p><span className="font-medium">Expiry:</span> {dayjs(expense.dd.expiry_date).format("DD MMM YYYY")}</p>}
                            {expense.dd.dd_location && <p><span className="font-medium">Location:</span> {expense.dd.dd_location}</p>}
                            {expense.dd.claim_date && <p><span className="font-medium">Claim Date:</span> {dayjs(expense.dd.claim_date).format("DD MMM YYYY")}</p>}
                          </>
                        ) : (
                          <p className="text-gray-400 text-xs col-span-2">DD details not available</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Asset linked */}
                  {expense.linked_module_type === "Assets" && expense.linked_module_id && (
                    <div className="border rounded-lg p-4 bg-red-50">
                      <h4 className="font-semibold text-red-900 mb-3">🏢 Asset</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <p><span className="font-medium">Asset ID:</span> {expense.linked_module_id}</p>
                        {expense.asset ? (
                          <>
                            {expense.asset.asset_name && <p><span className="font-medium">Name:</span> {expense.asset.asset_name}</p>}
                            {expense.asset.cost != null && <p><span className="font-medium">Cost:</span> ₹{Number(expense.asset.cost).toLocaleString("en-IN", {minimumFractionDigits:2})}</p>}
                            {expense.asset.category && <p><span className="font-medium">Category:</span> {expense.asset.category}</p>}
                            {expense.asset.purchase_date && <p><span className="font-medium">Purchase Date:</span> {dayjs(expense.asset.purchase_date).format("DD MMM YYYY")}</p>}
                            {expense.asset.status && <p><span className="font-medium">Status:</span> {expense.asset.status}</p>}
                          </>
                        ) : (
                          <p className="text-gray-400 text-xs col-span-2">Asset details not available</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Nothing linked */}
                  {!expense.client_expense_id && !expense.invoice_number && !expense.dd_id && !(expense.linked_module_type === "Assets" && expense.linked_module_id) && !expense.linked_purchase_ids && (
                    <div className="py-8 text-center text-gray-500">No records linked to this statement</div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">No records linked to this statement</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
