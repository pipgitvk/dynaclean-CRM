"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Trash2, CheckSquare, Square } from "lucide-react";
import toast from "react-hot-toast";
import {
  generatePayslipPDF,
  downloadPayslip,
  buildTemplatePayslipHTML,
  buildPayslipOptsFromMonthlyRecord,
} from "@/utils/payslipGenerator";
import {
  PayslipRecordsShell,
  PayslipRefreshButton,
  PayslipStatusCell,
  PayslipDownloadButton,
  PayslipViewButton,
  PayslipPreviewModal,
  PAYSLIP_UI,
  formatPayslipCurrency,
  formatPayslipMonth,
  payslipThClass,
  payslipThRightClass,
  payslipTdClass,
  payslipTdRightClass,
  payslipInputClass,
  payslipSecondaryButtonClass,
} from "@/components/empcrm/PayslipRecordsListUI";

export default function AdminSalarySlipsPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("");
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [userRole, setUserRole] = useState(null);

  // Bulk select state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  const canDelete = userRole === "SUPERADMIN" || userRole === "ADMIN";

  const load = useCallback(async () => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const q = new URLSearchParams();
      if (month) q.set("month", month);
      if (search.trim()) q.set("search", search.trim());
      const res = await fetch(`/api/empcrm/salary/all-records?${q.toString()}`);
      const data = await res.json();
      if (res.status === 403) {
        toast.error(data.message || "Not allowed");
        setRecords([]);
        return;
      }
      if (data.success) {
        setRecords(data.salaryRecords || []);
      } else {
        toast.error(data.message || "Failed to load");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load salary slips");
    } finally {
      setLoading(false);
    }
  }, [month, search]);

  useEffect(() => {
    load();
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setUserRole(d?.userRole ?? d?.user?.userRole ?? d?.role ?? null))
      .catch(() => {});
  }, [load]);

  const applySearch = () => {
    setSearch(searchDraft);
  };

  // Bulk select helpers
  const allSelected = records.length > 0 && selectedIds.size === records.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map((r) => r.id)));
    }
  };

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (
      !confirm(
        `Delete ${selectedIds.size} selected salary slip${selectedIds.size > 1 ? "s" : ""}? This cannot be undone.`
      )
    )
      return;

    setDeleting(true);
    const toastId = toast.loading(`Deleting ${selectedIds.size} record${selectedIds.size > 1 ? "s" : ""}…`);
    try {
      const res = await fetch("/api/empcrm/salary/all-records", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Deleted ${data.deleted} record${data.deleted !== 1 ? "s" : ""}`, { id: toastId });
        load();
      } else {
        toast.error(data.message || "Delete failed", { id: toastId });
      }
    } catch {
      toast.error("Error deleting records", { id: toastId });
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async (record) => {
    const toastId = toast.loading("Generating payslip…");
    try {
      const pdf = await generatePayslipPDF(record, record);
      const u = record.username || record.full_name || "employee";
      downloadPayslip(pdf, `Payslip_${u}_${record.salary_month}.pdf`);
      toast.success("Downloaded", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Could not generate payslip", { id: toastId });
    }
  };

  const handleView = (record) => {
    const opts = buildPayslipOptsFromMonthlyRecord(record);
    setPreviewHtml(buildTemplatePayslipHTML(opts));
    const u = record.username || record.full_name || "Employee";
    setPreviewTitle(`Payslip — ${u} — ${formatPayslipMonth(record.salary_month)}`);
    setPreviewOpen(true);
  };

  const toolbar = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 flex-1">
          <label className="flex flex-col gap-1 min-w-[11rem] text-xs font-semibold text-gray-800 uppercase tracking-wide">
            Salary month
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className={payslipInputClass}
            />
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-[12rem] text-xs font-semibold text-gray-800 uppercase tracking-wide">
            Search
            <div className="flex gap-2">
              <input
                type="search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
                placeholder="Username, emp ID, email…"
                className={payslipInputClass}
              />
              <button
                type="button"
                onClick={applySearch}
                className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-sm text-sm font-semibold text-white border border-black ${PAYSLIP_UI.navy} ${PAYSLIP_UI.navyHover}`}
              >
                <Search className="w-4 h-4" />
                Apply
              </button>
            </div>
          </label>
        </div>
        <PayslipRefreshButton onClick={load} loading={loading} />
      </div>

      {/* Bulk action bar — visible only to SUPERADMIN when rows are selected */}
      {canDelete && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-sm font-medium text-red-800">
            {selectedIds.size} record{selectedIds.size > 1 ? "s" : ""} selected
          </span>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-red-600 text-white rounded-md text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? "Deleting…" : "Delete Selected"}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-red-600 hover:text-red-800 underline"
          >
            Clear
          </button>
        </div>
      )}

      {(month || search) && (
        <button
          type="button"
          onClick={() => {
            setMonth("");
            setSearch("");
            setSearchDraft("");
          }}
          className={payslipSecondaryButtonClass + " self-start"}
        >
          Clear filters
        </button>
      )}
    </div>
  );

  return (
    <>
    <PayslipRecordsShell
      title="Salary slips"
      subtitle="All employees’ monthly records. Filter by month or search by user, employee ID, or email."
      listTitle="Pay slip records"
      toolbar={toolbar}
      listHint={
        !loading && records.length > 0
          ? "Showing up to 200 rows per request. Narrow month or search to find a specific slip."
          : undefined
      }
      loading={loading}
      empty={!loading && records.length === 0}
      emptyMessage="No records match your filters."
    >
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className={PAYSLIP_UI.navy}>
            {/* Select-all checkbox — SUPERADMIN only */}
            {canDelete && (
              <th className="px-3 py-3 w-10">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="flex items-center justify-center text-white hover:text-gray-200"
                  title={allSelected ? "Deselect all" : "Select all"}
                >
                  {allSelected ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : someSelected ? (
                    <CheckSquare className="w-4 h-4 opacity-60" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
            )}
            <th className={payslipThClass}>Employee</th>
            <th className={payslipThClass}>Emp ID</th>
            <th className={payslipThClass}>Month</th>
            <th className={payslipThClass}>Status</th>
            <th className={payslipThRightClass}>Net salary</th>
            <th className={payslipThRightClass}>Action</th>
          </tr>
        </thead>
        <tbody>
          {records.map((row) => {
            const isSelected = selectedIds.has(row.id);
            return (
              <tr
                key={row.id}
                className={`hover:bg-slate-50/90 ${isSelected ? "bg-red-50" : "bg-white"}`}
              >
                {/* Row checkbox — SUPERADMIN only */}
                {canDelete && (
                  <td className="px-3 py-3 w-10">
                    <button
                      type="button"
                      onClick={() => toggleOne(row.id)}
                      className={`flex items-center justify-center ${isSelected ? "text-red-600" : "text-gray-400 hover:text-gray-600"}`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                )}
                <td className={`${payslipTdClass} font-medium`}>
                  {row.username || row.full_name}
                </td>
                <td className={`${payslipTdClass} tabular-nums text-gray-700`}>{row.empId ?? "—"}</td>
                <td className={payslipTdClass}>{formatPayslipMonth(row.salary_month)}</td>
                <td className={payslipTdClass}>
                  <PayslipStatusCell status={row.status} />
                </td>
                <td className={payslipTdRightClass}>{formatPayslipCurrency(row.net_salary)}</td>
                <td className={`${payslipTdRightClass} align-middle`}>
                  <div className="flex justify-end flex-wrap gap-2">
                    <PayslipViewButton onClick={() => handleView(row)} />
                    <PayslipDownloadButton onClick={() => handleDownload(row)} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </PayslipRecordsShell>
    <PayslipPreviewModal
      open={previewOpen}
      title={previewTitle}
      html={previewHtml}
      onClose={() => setPreviewOpen(false)}
    />
    </>
  );
}
