"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  Download,
  ArrowUp,
  ArrowDown,
  X,
  FileText,
} from "lucide-react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const VCH_TYPES = [
  "Payment",
  "Receipt",
  "Journal",
  "Sales",
  "Purchase",
  "Contra",
  "Credit Note",
  "Debit Note",
  "Opening",
  "Other",
];

const makeEmpty = () => ({
  entry_date: dayjs().format("YYYY-MM-DD"),
  particulars: "",
  vch_type: "",
  vch_no: "",
  debit: "",
  credit: "",
});

export default function BuyerLedgerTable({ rows: initialRows, buyerName }) {
  const [rows, setRows] = useState(initialRows ?? []);
  const [sortCol, setSortCol] = useState("entry_date");
  const [sortDir, setSortDir] = useState("desc");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(makeEmpty);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [dateFrom] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [dateTo] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) {
      return <ArrowUp size={13} className="opacity-30 ml-1 inline" />;
    }

    return sortDir === "asc" ? (
      <ArrowUp size={13} className="ml-1 inline text-blue-600" />
    ) : (
      <ArrowDown size={13} className="ml-1 inline text-blue-600" />
    );
  };

  const filtered = useMemo(() => {
    const data = [...rows];

    data.sort((a, b) => {
      let aVal = a[sortCol] ?? "";
      let bVal = b[sortCol] ?? "";

      if (sortCol === "debit" || sortCol === "credit") {
        aVal = Number(aVal);
        bVal = Number(bVal);
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return data;
  }, [rows, sortCol, sortDir]);

  const totals = useMemo(() => {
    const debit = filtered.reduce((s, r) => s + Number(r.debit || 0), 0);
    const credit = filtered.reduce((s, r) => s + Number(r.credit || 0), 0);

    return {
      debit,
      credit,
      balance: debit - credit,
    };
  }, [filtered]);

  const fmt = (n) =>
    Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const safeText = (v) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const handleSave = async () => {
    if (!form.entry_date) return toast.error("Date is required");
    if (!form.particulars.trim()) return toast.error("Particulars is required");
    if (!form.vch_type) return toast.error("Vch Type is required");

    const debit = parseFloat(form.debit) || 0;
    const credit = parseFloat(form.credit) || 0;

    if (debit === 0 && credit === 0) {
      return toast.error("Enter Debit or Credit amount");
    }

    setSaving(true);

    try {
      const res = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          entry_date: form.entry_date,
          particulars: form.particulars.trim(),
          vch_type: form.vch_type,
          vch_no: form.vch_no.trim(),
          debit,
          credit,
          buyer_name: buyerName,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Save failed");

      setRows((prev) => [data.entry, ...prev]);
      toast.success("Entry added");
      setShowModal(false);
      setForm(makeEmpty());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this ledger entry?")) return;

    setDeletingId(id);

    try {
      const res = await fetch(`/api/ledger/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Delete failed");

      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("Entry deleted");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("No entries to download");
      return;
    }

    const company = {
      name: "Dynaclean Industries Pvt. Ltd.",
      address1: "4th Floor, PLOT No-9, Block-B, Pocket-3, Sector-17",
      address2: "Dwarka",
      email: "sales@dynacleanindustries.com",
    };

    const csvLines = [];

    csvLines.push(`"${company.name}"`);
    csvLines.push(`"${company.address1}"`);
    csvLines.push(`"${company.address2}"`);
    csvLines.push(`"E-Mail: ${company.email}"`);
    csvLines.push("");
    csvLines.push(`"${buyerName}"`);
    csvLines.push(`"Ledger Account"`);
    csvLines.push("");
    csvLines.push(
      `"Period: ${dayjs(dateFrom).format("D-MMM-YY")} to ${dayjs(dateTo).format(
        "D-MMM-YY"
      )}"`
    );
    csvLines.push("");

    const headers = ["Date", "Particulars", "Vch Type", "Vch No", "Debit", "Credit"];
    csvLines.push(headers.map((h) => `"${h}"`).join(","));

    filtered.forEach((r) => {
      csvLines.push(
        [
          `"${dayjs(r.entry_date).format("DD/MM/YYYY")}"`,
          `"${String(r.particulars || "").replace(/"/g, '""')}"`,
          `"${r.vch_type || ""}"`,
          `"${r.vch_no || ""}"`,
          `"${Number(r.debit || 0).toFixed(2)}"`,
          `"${Number(r.credit || 0).toFixed(2)}"`,
        ].join(",")
      );
    });

    csvLines.push("");
    csvLines.push(
      [
        "",
        `"Total"`,
        "",
        "",
        `"${Number(totals.debit).toFixed(2)}"`,
        `"${Number(totals.credit).toFixed(2)}"`,
      ].join(",")
    );

    const csv = csvLines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `ledger_${buyerName.replace(/\s+/g, "_")}_${dayjs().format("DD-MM-YYYY")}.csv`
    );

    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Ledger downloaded as Excel");
  };



const handleExportPDF = async () => {
  if (filtered.length === 0) {
    toast.error("No entries to download");
    return;
  }

  const fmtAmt = (n) =>
    Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const safe = (v) => String(v ?? "");

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const marginL = 40;
  const tableRight = 570;

  let y = 42;

  const center = (text, size = 8, bold = false, gap = 10) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.text(text, pageW / 2, y, { align: "center" });
    y += gap;
  };

  const right = (text, x, yy, size = 8, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.text(text, x, yy, { align: "right" });
  };

  const left = (text, x, yy, size = 8, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.text(text, x, yy);
  };

  const line = (x1, yy, x2, width = 0.7) => {
    pdf.setLineWidth(width);
    pdf.line(x1, yy, x2, yy);
  };

  const dateRangeStr = `${dayjs(dateFrom).format("D-MMM-YY")} to ${dayjs(
    dateTo
  ).format("D-MMM-YY")}`;

  const totalDebit = filtered.reduce((s, r) => s + Number(r.debit || 0), 0);
  const totalCredit = filtered.reduce((s, r) => s + Number(r.credit || 0), 0);

  const closingDebit = totalCredit > totalDebit ? totalCredit - totalDebit : 0;
  const closingCredit = totalDebit > totalCredit ? totalDebit - totalCredit : 0;
  const finalTotal = Math.max(totalDebit, totalCredit);

const col = {
  date: marginL,
  drcr: marginL + 65,
  particulars: marginL + 90,   // Cr/Dr ke baad text right me
  vchType: marginL + 280,      // Particulars aur Vch Type ke beech space
  vchNoEnd: marginL + 405,
  debitStart: marginL + 410,
  debitEnd: marginL + 480,
  creditStart: marginL + 495,
  creditEnd: marginL + 535,
};
  const drawTableHeader = () => {
    line(marginL, y - 4, tableRight, 0.7);

    left("Date", col.date, y + 6, 9, true);
left("Particulars", col.particulars, y + 6, 9, true);
left("Vch Type", col.vchType, y + 6, 9, true);
    right("Vch No.", col.vchNoEnd, y + 6, 9, true);
    right("Debit", col.debitEnd, y + 6, 9, true);
    right("Credit", col.creditEnd, y + 6, 9, true);

    line(marginL, y + 11, tableRight, 0.7);
    y += 22;
  };

  const addHeader = (pageNo = 1) => {
    y = 42;

    center("Dynaclean Industries Pvt. Ltd.", 11, true, 11);
    center("4th Floor, PLOT No-9, Block-B, Pocket-3, Sector-17", 9, true, 10);
    center("Dwarka,", 9, true, 12);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("E-Mail : ", pageW / 2 - 55, y);
    pdf.text("sales@dynacleanindustries.com", pageW / 2 - 15, y);
    line(pageW / 2 - 15, y + 1, pageW / 2 + 98, 0.4);

    y += 22;

    center(safe(buyerName), 13, true, 13);
    center("Ledger Account", 10, true, 11);

    y += 3;

    center("Full Building, 37/537, Vasant Kunj Road,", 9, true, 11);
    center("Mahipalpur, South West,", 9, true, 22);

    center(dateRangeStr, 10, true, 16);

    right(`Page ${pageNo}`, tableRight, y, 9, true);
    y += 8;

    drawTableHeader();
  };

  addHeader(1);

  let pageNo = 1;
  const rowH = 16;

  filtered.forEach((r) => {
    if (y > pageH - 95) {
      pdf.addPage();
      pageNo += 1;
      addHeader(pageNo);
    }

    const debit = Number(r.debit || 0);
    const credit = Number(r.credit || 0);
    const drcr = debit > 0 ? "Dr" : credit > 0 ? "Cr" : "";

    const particularsText = safe(r.particulars);
const wrappedParticulars = pdf.splitTextToSize(particularsText, 165);

left(dayjs(r.entry_date).format("D-MMM-YY"), col.date, y, 9, false);
left(drcr, col.drcr, y, 9, false);
left(wrappedParticulars[0] || "", col.particulars, y, 9, true);

    left(safe(r.vch_type), col.vchType, y, 9, true);
    right(safe(r.vch_no), col.vchNoEnd, y, 9, false);

    if (debit > 0) right(fmtAmt(debit), col.debitEnd, y, 9, false);
    if (credit > 0) right(fmtAmt(credit), col.creditEnd, y, 9, false);

    y += rowH;

    for (let i = 1; i < wrappedParticulars.length; i++) {
     left(wrappedParticulars[i], col.particulars, y, 9, true);
      y += rowH;
    }
  });

  y += 12;

  if (y > pageH - 90) {
    pdf.addPage();
    pageNo += 1;
    addHeader(pageNo);
  }
left(closingDebit > 0 ? "Dr" : "Cr", col.drcr, y, 9, false);
left("Closing Balance", col.particulars, y, 9, true);

  if (closingDebit > 0) {
    right(fmtAmt(closingDebit), col.debitEnd, y, 9, false);
  }

  if (closingCredit > 0) {
    right(fmtAmt(closingCredit), col.creditEnd, y, 9, false);
  }

  y += 16;

  // Single final total row only
  line(col.debitStart, y - 8, col.debitEnd, 0.7);
  line(col.creditStart, y - 8, col.creditEnd, 0.7);

  right(fmtAmt(finalTotal), col.debitEnd, y, 9, true);
  right(fmtAmt(finalTotal), col.creditEnd, y, 9, true);

  line(col.debitStart, y + 5, col.debitEnd, 0.7);
  line(col.creditStart, y + 5, col.creditEnd, 0.7);

  pdf.save(
    `ledger_${buyerName.replace(/\s+/g, "_")}_${dayjs().format("DD-MM-YYYY")}.pdf`
  );

  toast.success("Ledger PDF downloaded");
};



  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Ledger</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} entries
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add Entry
          </button>

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-green-700 transition-colors"
          >
            <Download size={16} />
            Download Excel
          </button>

          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-600 transition-colors"
          >
            <FileText size={16} />
            Download PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Debit", value: totals.debit, color: "text-red-600" },
          { label: "Total Credit", value: totals.credit, color: "text-green-600" },
          {
            label: "Net Balance",
            value: Math.abs(totals.balance),
            color: totals.balance >= 0 ? "text-red-600" : "text-green-600",
            suffix: totals.balance >= 0 ? " (Dr)" : " (Cr)",
          },
        ].map(({ label, value, color, suffix }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {label}
            </p>
            <p className={`mt-1 text-xl font-bold ${color}`}>
              ₹{fmt(value)}
              {suffix ?? ""}
            </p>
          </div>
        ))}
      </div>

      <div className="hidden lg:block overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {[
                { label: "Date", col: "entry_date" },
                { label: "Particulars", col: "particulars" },
                { label: "Vch Type", col: "vch_type" },
                { label: "Vch No", col: "vch_no" },
                { label: "Debit (₹)", col: "debit" },
                { label: "Credit (₹)", col: "credit" },
              ].map(({ label, col }) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-4 py-3 text-left font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap hover:text-blue-600"
                >
                  {label}
                  <SortIcon col={col} />
                </th>
              ))}

              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-gray-400 bg-white"
                >
                  No ledger entries found. Click <strong>Add Entry</strong> to
                  create one.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.id}
                  className="bg-white hover:bg-blue-50 transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                    {dayjs(row.entry_date).format("DD MMM YYYY")}
                  </td>

                  <td className="px-4 py-3 text-gray-800 max-w-xs">
                    {row.particulars}
                  </td>

                  <td className="px-4 py-3">
                    <VchBadge type={row.vch_type} />
                  </td>

                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {row.vch_no || "—"}
                  </td>

                  <td className="px-4 py-3 text-right font-mono text-red-600 whitespace-nowrap">
                    {Number(row.debit) > 0 ? `₹${fmt(row.debit)}` : "—"}
                  </td>

                  <td className="px-4 py-3 text-right font-mono text-green-600 whitespace-nowrap">
                    {Number(row.credit) > 0 ? `₹${fmt(row.credit)}` : "—"}
                  </td>

                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(row.id)}
                      disabled={deletingId === row.id}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition"
                      title="Delete entry"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {filtered.length > 0 && (
            <tfoot>
              {totals.debit !== totals.credit && (
                <tr className="bg-green-50 border-t border-gray-200">
                  <td className="px-4 py-2 text-gray-400 text-xs whitespace-nowrap">
                    —
                  </td>

                  <td className="px-4 py-2 text-xs text-gray-500 italic">
                    Balance c/d
                  </td>

                  <td className="px-4 py-2" />
                  <td className="px-4 py-2" />

                  <td className="px-4 py-2 text-right font-mono text-red-500 text-xs">
                    {totals.credit > totals.debit
                      ? `₹${fmt(totals.credit - totals.debit)}`
                      : "—"}
                  </td>

                  <td className="px-4 py-2 text-right font-mono text-green-600 font-semibold bg-green-100">
                    {totals.debit > totals.credit
                      ? `₹${fmt(totals.debit - totals.credit)}`
                      : "—"}
                  </td>

                  <td className="px-4 py-2" />
                </tr>
              )}

              <tr className="bg-gray-100 border-t-2 border-gray-400 font-bold">
                <td colSpan={4} className="px-4 py-3 text-gray-800">
                  Total ({filtered.length} entries)
                </td>

                <td className="px-4 py-3 text-right font-mono text-red-600 border-t border-gray-400">
                  ₹{fmt(Math.max(totals.debit, totals.credit))}
                </td>

                <td className="px-4 py-3 text-right font-mono text-green-700 border-t border-gray-400">
                  ₹{fmt(Math.max(totals.debit, totals.credit))}
                </td>

                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="lg:hidden space-y-3">
        {filtered.length === 0 ? (
          <p className="text-center py-10 text-gray-400">
            No ledger entries found.
          </p>
        ) : (
          filtered.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-gray-800">
                    {row.particulars}
                  </p>

                  <p className="text-xs text-gray-500 mt-0.5">
                    {dayjs(row.entry_date).format("DD MMM YYYY")}
                  </p>
                </div>

                <button
                  onClick={() => handleDelete(row.id)}
                  disabled={deletingId === row.id}
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <VchBadge type={row.vch_type} />
                {row.vch_no && (
                  <span className="text-gray-500">#{row.vch_no}</span>
                )}
              </div>

              <div className="mt-3 flex gap-4 text-sm font-mono">
                {Number(row.debit) > 0 && (
                  <span className="text-red-600 font-semibold">
                    Dr ₹{fmt(row.debit)}
                  </span>
                )}

                {Number(row.credit) > 0 && (
                  <span className="text-green-600 font-semibold">
                    Cr ₹{fmt(row.credit)}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-lg font-bold text-gray-800">
                Add Ledger Entry
              </h3>

              <button
                onClick={() => setShowModal(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Date
                </label>
                <input
                  type="date"
                  value={form.entry_date}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, entry_date: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Particulars
                </label>
                <input
                  type="text"
                  value={form.particulars}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, particulars: e.target.value }))
                  }
                  placeholder="Enter particulars"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Vch Type
                </label>
                <select
                  value={form.vch_type}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, vch_type: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">Select type</option>
                  {VCH_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Vch No
                </label>
                <input
                  type="text"
                  value={form.vch_no}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, vch_no: e.target.value }))
                  }
                  placeholder="Enter voucher no"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Debit
                  </label>
                  <input
                    type="number"
                    value={form.debit}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, debit: e.target.value }))
                    }
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Credit
                  </label>
                  <input
                    type="number"
                    value={form.credit}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, credit: e.target.value }))
                    }
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );


function VchBadge({ type }) {
  const colorMap = {
    Payment: "bg-orange-100 text-orange-700",
    Receipt: "bg-green-100 text-green-700",
    Journal: "bg-blue-100 text-blue-700",
    Sales: "bg-purple-100 text-purple-700",
    Purchase: "bg-red-100 text-red-700",
    Contra: "bg-yellow-100 text-yellow-700",
    "Credit Note": "bg-teal-100 text-teal-700",
    "Debit Note": "bg-pink-100 text-pink-700",
    Opening: "bg-gray-100 text-gray-700",
    Other: "bg-slate-100 text-slate-700",
  };

  const cls = colorMap[type] || "bg-gray-100 text-gray-600";

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {type || "—"}
    </span>
  );
}
}