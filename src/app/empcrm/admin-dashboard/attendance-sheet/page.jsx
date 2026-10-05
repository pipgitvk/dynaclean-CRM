"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, FileSpreadsheet, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import AttendanceSheetGrid from "@/components/empcrm/AttendanceSheetGrid";
import { downloadAttendanceSheetExcel } from "@/lib/exportAttendanceSheetExcel";

export default function AttendanceSheetPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!month) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/empcrm/attendance/attendance-sheet?month=${encodeURIComponent(month)}`
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message || "Failed to load attendance sheet");
        setData(null);
        return;
      }
      setData(json);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load attendance sheet");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExportExcel = async () => {
    if (!data?.rows?.length) {
      toast.error("No data to export.");
      return;
    }
    setExportingExcel(true);
    const toastId = toast.loading("Building Excel…");
    try {
      const count = await downloadAttendanceSheetExcel(data);
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
          <h2 className="text-xl font-bold text-gray-900">Attendance Sheet</h2>
          <p className="text-sm text-gray-600 mt-1">Monthly attendance register (calendar month)</p>
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={loading || exportingExcel || !data?.rows?.length}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
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

      <AttendanceSheetGrid data={data} loading={loading} />
    </div>
  );
}
