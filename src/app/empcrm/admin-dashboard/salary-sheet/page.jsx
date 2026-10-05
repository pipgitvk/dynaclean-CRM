"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, FileSpreadsheet, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { usePathname } from "next/navigation";
import SalarySheetTable from "@/components/empcrm/SalarySheetTable";
import { downloadSalarySheetExcel } from "@/lib/exportSalarySheetExcel";

export default function SalarySheetPage() {
  const pathname = usePathname();
  const isAccounts = String(pathname || "").startsWith("/accounts-dashboard");

  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  });
  const [loading, setLoading] = useState(true);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!month) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/empcrm/salary/salary-sheet?month=${encodeURIComponent(month)}`
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message || "Failed to load salary sheet");
        setData(null);
        return;
      }
      setData(json);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load salary sheet");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExportExcel = async () => {
    const rows = data?.rows;
    if (!rows?.length) {
      toast.error("No data to export. Load the sheet first.");
      return;
    }
    setExportingExcel(true);
    const toastId = toast.loading("Building Excel…");
    try {
      const count = await downloadSalarySheetExcel({
        month,
        monthLabel: data.month_label,
        companyName: data.company_name,
        rows,
      });
      toast.success(`Exported ${count} row${count === 1 ? "" : "s"}`, { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Could not export Excel", { id: toastId });
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[100vw]">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Salary Sheet</h2>
          <p className="text-sm text-gray-600 mt-1">
            Monthly payroll view from attendance and salary structure
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <CalendarDays className="w-4 h-4 text-gray-500" />
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={loading || exportingExcel || !data?.rows?.length}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            {exportingExcel ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-green-700" />
            )}
            {exportingExcel ? "Exporting…" : "Download Excel"}
          </button>
        </div>
      </div>

      {isAccounts && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          You are viewing the accounts dashboard route; data is the same as Employee CRM salary
          sheet.
        </p>
      )}

      <SalarySheetTable
        rows={data?.rows}
        monthLabel={data?.month_label}
        companyName={data?.company_name}
        loading={loading}
      />
    </div>
  );
}
