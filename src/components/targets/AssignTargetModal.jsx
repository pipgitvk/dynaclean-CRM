"use client";

import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import { useState, useEffect, useCallback, useMemo } from "react";
import { X, Loader2 } from "lucide-react";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const monthDateRange = (year, month) => {
  const pad = (n) => String(n).padStart(2, "0");
  const format = (date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return {
    dateFrom: format(new Date(year, month - 1, 1)),
    dateTo: format(new Date(year, month, 0)),
  };
};

const defaultPeriod = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const range = monthDateRange(year, month);
  return { year, month, ...range };
};

export default function AssignTargetModal({ isOpen, onClose, onSuccess }) {
  const initial = defaultPeriod();
  const [filterMonth, setFilterMonth] = useState(initial.month);
  const [filterYear, setFilterYear] = useState(initial.year);
  const [startDate, setStartDate] = useState(initial.dateFrom);
  const [endDate, setEndDate] = useState(initial.dateTo);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageOk, setMessageOk] = useState(false);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, index) => currentYear - 5 + index);
  }, []);

  const applyMonthRange = useCallback((year, month) => {
    const range = monthDateRange(year, month);
    setStartDate(range.dateFrom);
    setEndDate(range.dateTo);
  }, []);

  const loadBulkTargets = useCallback(async (fromYmd, toYmd) => {
    const from = String(fromYmd || "").trim();
    const to = String(toYmd || "").trim();
    if (!from || !to) return;
    const start = from <= to ? from : to;
    const end = from <= to ? to : from;
    setLoading(true);
    setMessage("");
    try {
      const qs = new URLSearchParams({
        startDate: start,
        endDate: end,
      });
      const res = await fetch(`/api/assign-target/bulk?${qs.toString()}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to load targets");
      }
      setRows(
        (data.employees || []).map((e) => ({
          username: e.username,
          id: e.id ?? null,
          target: e.target ?? "",
        })),
      );
    } catch (error) {
      setMessage(error.message || "Failed to load employees.");
      setMessageOk(false);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const period = defaultPeriod();
    setFilterMonth(period.month);
    setFilterYear(period.year);
    setStartDate(period.dateFrom);
    setEndDate(period.dateTo);
    setMessage("");
    setMessageOk(false);
    setSaving(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !startDate || !endDate) return;
    loadBulkTargets(startDate, endDate);
  }, [isOpen, startDate, endDate, loadBulkTargets]);

  const handleMonthChange = (value) => {
    const month = Number(value);
    setFilterMonth(month);
    applyMonthRange(filterYear, month);
  };

  const handleYearChange = (value) => {
    const year = Number(value);
    setFilterYear(year);
    applyMonthRange(year, filterMonth);
  };

  const handleStartChange = (value) => {
    setStartDate(value);
    if (value && endDate && value > endDate) {
      setEndDate(value);
    }
  };

  const handleEndChange = (value) => {
    setEndDate(value);
    if (value && startDate && value < startDate) {
      setStartDate(value);
    }
  };

  const handleTargetChange = (username, value) => {
    setRows((prev) =>
      prev.map((r) =>
        r.username === username ? { ...r, target: value } : r,
      ),
    );
  };

  const handleSaveAll = async (e) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setMessage("Select start and end dates.");
      setMessageOk(false);
      return;
    }

    const withValue = rows.filter((r) => {
      const n = Number(r.target);
      return r.target !== "" && Number.isFinite(n) && n > 0;
    });
    if (!withValue.length) {
      setMessage("Enter at least one target amount before saving.");
      setMessageOk(false);
      return;
    }

    const start = startDate <= endDate ? startDate : endDate;
    const end = startDate <= endDate ? endDate : startDate;

    setSaving(true);
    setMessage("Saving...");
    setMessageOk(false);
    try {
      const res = await fetch("/api/assign-target/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          target_start_date: start,
          target_end_date: end,
          rows: rows.map((r) => ({
            username: r.username,
            target: r.target,
            id: r.id,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Save failed");
      }
      setMessage(
        data.message ||
          `Saved (${data.updated ?? 0} updated, ${data.inserted ?? 0} new).`,
      );
      setMessageOk(true);
      await loadBulkTargets(start, end);
      onSuccess?.();
    } catch (error) {
      setMessage(error.message || "Network error. Please try again.");
      setMessageOk(false);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close modal"
        onClick={() => !saving && onClose()}
      />
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-target-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
          <div>
            <h2
              id="assign-target-title"
              className="text-2xl font-extrabold text-gray-800"
            >
              Assign Targets (Bulk)
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Month or date range for all employees · edit targets and save
              together
            </p>
          </div>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSaveAll} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-4 border-b border-gray-100 px-6 py-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label
                  htmlFor="bulk-target-month"
                  className="mb-1 block text-sm font-medium text-gray-800"
                >
                  Month
                </label>
                <select
                  id="bulk-target-month"
                  value={filterMonth}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  disabled={saving}
                  className="min-w-[140px] rounded-lg border border-gray-600 bg-white px-3 py-3 text-sm text-gray-900 disabled:opacity-60"
                >
                  {MONTH_NAMES.map((name, index) => (
                    <option key={name} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="bulk-target-year"
                  className="mb-1 block text-sm font-medium text-gray-800"
                >
                  Year
                </label>
                <select
                  id="bulk-target-year"
                  value={filterYear}
                  onChange={(e) => handleYearChange(e.target.value)}
                  disabled={saving}
                  className="min-w-[100px] rounded-lg border border-gray-600 bg-white px-3 py-3 text-sm text-gray-900 disabled:opacity-60"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="min-w-[10rem] flex-1">
                <label
                  htmlFor="bulk-target-start"
                  className="mb-1 block text-sm font-medium text-gray-800"
                >
                  Start date (all employees)
                </label>
                <TypeableDateFilterInput
                  id="bulk-target-start"
                  value={startDate}
                  onChange={handleStartChange}
                  disabled={saving}
                  className="w-full rounded-lg border border-gray-600 px-4 py-3 disabled:opacity-60"
                />
              </div>
              <div className="min-w-[10rem] flex-1">
                <label
                  htmlFor="bulk-target-end"
                  className="mb-1 block text-sm font-medium text-gray-800"
                >
                  End date (all employees)
                </label>
                <TypeableDateFilterInput
                  id="bulk-target-end"
                  value={endDate}
                  onChange={handleEndChange}
                  disabled={saving}
                  className="w-full rounded-lg border border-gray-600 px-4 py-3 disabled:opacity-60"
                />
              </div>
            </div>

            {message ? (
              <div
                className={`rounded-lg p-3 text-center text-sm font-medium ${
                  messageOk
                    ? "bg-green-600 text-white"
                    : message === "Saving..."
                      ? "bg-gray-100 text-gray-800"
                      : "bg-red-600 text-white"
                }`}
              >
                {message}
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading employees…
              </div>
            ) : rows.length === 0 ? (
              <p className="py-8 text-center text-gray-500">
                No active employees found.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    <th className="py-2 pr-4">Employee</th>
                    <th className="py-2 pl-2">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => (
                    <tr key={row.username} className="hover:bg-gray-50/80">
                      <td className="py-2.5 pr-4 font-medium text-gray-900">
                        {row.username}
                      </td>
                      <td className="py-2 pl-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.target}
                          onChange={(e) =>
                            handleTargetChange(row.username, e.target.value)
                          }
                          disabled={saving}
                          placeholder="—"
                          className="w-full min-w-[8rem] rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-600 disabled:opacity-60"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="border-t border-gray-100 px-6 py-4">
            <button
              type="submit"
              disabled={saving || loading || rows.length === 0}
              className="w-full rounded-lg bg-gray-700 px-4 py-3 text-lg font-bold text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save All Targets"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}