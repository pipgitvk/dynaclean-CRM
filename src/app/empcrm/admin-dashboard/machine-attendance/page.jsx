"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, RefreshCw, Search } from "lucide-react";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currentMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toYmd(first), to: toYmd(now) };
}

function formatDateOnly(value) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    const s = String(value).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      return new Date(
        parseInt(m[1], 10),
        parseInt(m[2], 10) - 1,
        parseInt(m[3], 10)
      ).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
    return s;
  }
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTimesCell(value) {
  const s = String(value || "").trim();
  return s || "—";
}

function formatPunchDisplay(value) {
  if (!value) return "—";
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (!m) return s;
  const d = new Date(
    parseInt(m[1], 10),
    parseInt(m[2], 10) - 1,
    parseInt(m[3], 10),
    parseInt(m[4], 10),
    parseInt(m[5], 10),
    parseInt(m[6], 10)
  );
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function MachineAttendancePage() {
  const monthDefaults = useMemo(() => currentMonthRange(), []);
  const [fromDate, setFromDate] = useState(monthDefaults.from);
  const [toDate, setToDate] = useState(monthDefaults.to);
  const [empCode, setEmpCode] = useState("");
  const [appliedFrom, setAppliedFrom] = useState(monthDefaults.from);
  const [appliedTo, setAppliedTo] = useState(monthDefaults.to);
  const [appliedEmpCode, setAppliedEmpCode] = useState("");
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [viewMode, setViewMode] = useState("daily");

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        view: viewMode,
      });
      if (appliedFrom) q.set("from", appliedFrom);
      if (appliedTo) q.set("to", appliedTo);
      if (appliedEmpCode) q.set("search", appliedEmpCode);
      const res = await fetch(`/api/empcrm/machine-attendance?${q}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to load data");
      setRows(data.rows || []);
      setPagination(
        data.pagination || { page: 1, limit: pageSize, total: 0, pages: 1 }
      );
    } catch (e) {
      toast.error(e.message);
      setRows([]);
      setPagination({ page: 1, limit: pageSize, total: 0, pages: 1 });
    } finally {
      setLoading(false);
    }
  }, [appliedFrom, appliedTo, appliedEmpCode, page, pageSize, viewMode]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const applyFilters = () => {
    if (fromDate && toDate && fromDate > toDate) {
      toast.error("From date must be before to date.");
      return;
    }
    setPage(1);
    setAppliedFrom(fromDate.trim());
    setAppliedTo(toDate.trim());
    setAppliedEmpCode(empCode.trim());
  };

  const syncFromMachine = async () => {
    const syncFrom = fromDate.trim() || monthDefaults.from;
    const syncTo = toDate.trim() || monthDefaults.to;
    if (syncFrom > syncTo) {
      toast.error("From date must be before to date.");
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch("/api/empcrm/machine-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: syncFrom,
          to: syncTo,
          empCode: (() => {
            const t = empCode.trim();
            if (!t || /\s/.test(t)) return "ALL";
            return t;
          })(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Sync failed");
      toast.success(
        `Synced: ${data.fetched ?? 0} fetched, ${data.inserted ?? 0} new, ${data.updated ?? 0} updated.`
      );
      setFromDate(syncFrom);
      setToDate(syncTo);
      setAppliedFrom(syncFrom);
      setAppliedTo(syncTo);
      setAppliedEmpCode(empCode.trim());
      setPage(1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const total = pagination.total ?? 0;
  const limit = pagination.limit ?? pageSize;
  const currentPage = pagination.page ?? page;
  const totalPages = pagination.pages ?? 1;
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * limit + 1;
  const rangeEnd = Math.min(currentPage * limit, total);

  const goToPage = (p) => {
    const next = Math.max(1, Math.min(totalPages, p));
    setPage(next);
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Machine Attendance</h1>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-100 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            From
            <TypeableDateFilterInput
              value={fromDate}
              onChange={setFromDate}
              className="rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            To
            <TypeableDateFilterInput
              value={toDate}
              onChange={setToDate}
              className="rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Emp code or name
            <input
              type="text"
              value={empCode}
              onChange={(e) => setEmpCode(e.target.value)}
              placeholder="e.g. 102 or Vijay"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyFilters}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Search className="h-4 w-4" aria-hidden />
              Search
            </button>
            <button
              type="button"
              onClick={syncFromMachine}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-md border border-teal-600 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100 disabled:opacity-60"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
              Sync
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-gray-900">{total}</span> total
            record{total === 1 ? "" : "s"}
            {total > 0 ? (
              <span className="text-gray-500">
                {" "}
                · showing {rangeStart}–{rangeEnd}
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-gray-600 inline-flex items-center gap-2">
              View
              <select
                value={viewMode}
                onChange={(e) => {
                  setViewMode(e.target.value);
                  setPage(1);
                }}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="daily">Daily (check-in / out)</option>
                <option value="raw">All punches</option>
              </select>
            </label>
            <label className="text-sm text-gray-600 inline-flex items-center gap-2">
              Per page
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            {loading ? (
              <span className="text-sm text-gray-500 inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </span>
            ) : null}
          </div>
        </div>
        <div className="overflow-x-auto max-h-[min(70vh,900px)] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Emp code</th>
                <th className="px-4 py-3 text-left">Name</th>
                {viewMode === "daily" ? (
                  <>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Check-in (AM)</th>
                    <th className="px-4 py-3 text-left">Check-out (PM)</th>
                    <th className="px-4 py-3 text-left">Punches</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 text-left">Punch date & time</th>
                    <th className="px-4 py-3 text-left">M Flag</th>
                    <th className="px-4 py-3 text-left">Last synced</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {!loading && rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={viewMode === "daily" ? 7 : 6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No punches found. Sync from machine or clear filters (Show
                    all).
                  </td>
                </tr>
              ) : viewMode === "daily" ? (
                rows.map((row, index) => (
                  <tr
                    key={`${row.emp_code}-${row.punch_date}`}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-4 py-2 text-gray-500 tabular-nums">
                      {rangeStart + index}
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {row.emp_code}
                    </td>
                    <td className="px-4 py-2 text-gray-800">
                      {row.employee_name}
                    </td>
                    <td className="px-4 py-2 text-gray-700 whitespace-nowrap">
                      {formatDateOnly(row.punch_date)}
                    </td>
                    <td className="px-4 py-2 text-green-800 font-medium">
                      {formatTimesCell(row.check_in)}
                    </td>
                    <td className="px-4 py-2 text-indigo-800 font-medium">
                      {formatTimesCell(row.check_out)}
                    </td>
                    <td className="px-4 py-2 text-gray-600 tabular-nums">
                      {row.punch_count ?? "—"}
                    </td>
                  </tr>
                ))
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500 tabular-nums">
                      {rangeStart + index}
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {row.emp_code}
                    </td>
                    <td className="px-4 py-2 text-gray-800">
                      {row.employee_name}
                    </td>
                    <td className="px-4 py-2 text-gray-700 whitespace-nowrap">
                      {formatPunchDisplay(row.punch_datetime)}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {row.m_flag || "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs whitespace-nowrap">
                      {row.synced_at
                        ? new Date(row.synced_at).toLocaleString("en-IN")
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > 0 ? (
          <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={currentPage <= 1 || loading}
              onClick={() => goToPage(1)}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
            >
              First
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1 || loading}
                onClick={() => goToPage(currentPage - 1)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700 px-2 tabular-nums">
                Page{" "}
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={page}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!Number.isNaN(v)) goToPage(v);
                  }}
                  onBlur={() => {
                    if (page < 1) setPage(1);
                    if (page > totalPages) setPage(totalPages);
                  }}
                  className="w-16 rounded border border-gray-300 px-2 py-1 text-center text-sm"
                  aria-label="Page number"
                />{" "}
                of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages || loading}
                onClick={() => goToPage(currentPage + 1)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
            <button
              type="button"
              disabled={currentPage >= totalPages || loading}
              onClick={() => goToPage(totalPages)}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
            >
              Last
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
