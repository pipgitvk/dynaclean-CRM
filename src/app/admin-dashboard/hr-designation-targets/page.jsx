"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, Eye, Pencil, Plus, Search, X } from "lucide-react";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

/** Plain numbers (no ₹) for target and achieved. */
function formatTargetPlain(n) {
  if (n == null || Number.isNaN(n)) return "0";
  return Math.round(Number(n)).toLocaleString("en-IN");
}

function formatChartAxis(v) {
  if (v == null || Number.isNaN(v)) return "0";
  const x = Number(v);
  if (x >= 100000) return `${(x / 100000).toFixed(x >= 1000000 ? 0 : 1)}L`;
  if (x >= 1000) return `${(x / 1000).toFixed(0)}K`;
  return Math.round(x).toLocaleString("en-IN");
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-gray-700">
          <span className="text-gray-500">{p.name}: </span>
          {formatTargetPlain(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function HrDesignationTargetsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [hasHrUsernameColumn, setHasHrUsernameColumn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [hrUsers, setHrUsers] = useState([]);
  const [loadingHrUsers, setLoadingHrUsers] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);
  const [editRow, setEditRow] = useState(null);

  const [formDesignation, setFormDesignation] = useState("");
  const [formHr, setFormHr] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formMonth, setFormMonth] = useState(now.getMonth() + 1);
  const [formYear, setFormYear] = useState(now.getFullYear());
  const [saving, setSaving] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/hr-designation-targets-dashboard?month=${month}&year=${year}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (json.success) {
        setDashboard(json);
        setHasHrUsernameColumn(Boolean(json.hasHrUsernameColumn));
      } else {
        setToast({ type: "error", text: json.error || "Failed to load" });
        setDashboard(null);
      }
    } catch (e) {
      setToast({ type: "error", text: e.message || "Network error" });
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingHrUsers(true);
      try {
        const res = await fetch("/api/admin/hr-users-for-targets", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.success) setHrUsers(json.users || []);
      } catch {
        if (!cancelled) setHrUsers([]);
      } finally {
        if (!cancelled) setLoadingHrUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openAdd = () => {
    setFormMonth(month);
    setFormYear(year);
    setFormDesignation("");
    setFormHr("");
    setFormTarget("");
    setAddOpen(true);
    setToast(null);
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    if (!hasHrUsernameColumn) return;
    if (!formHr.trim()) {
      setToast({ type: "error", text: "Select an HR user." });
      return;
    }
    if (!formDesignation.trim()) {
      setToast({ type: "error", text: "Designation is required." });
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/admin/hr-designation-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designation: formDesignation.trim(),
          hr_username: formHr.trim(),
          target_amount: Number(formTarget),
          month: formMonth,
          year: formYear,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setToast({ type: "error", text: json.error || "Save failed" });
        return;
      }
      setToast({ type: "ok", text: json.message || "Saved" });
      setAddOpen(false);
      if (formMonth === month && formYear === year) await loadDashboard();
      else {
        setMonth(formMonth);
        setYear(formYear);
      }
    } catch (err) {
      setToast({ type: "error", text: err.message || "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editRow) return;
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/admin/hr-designation-targets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editRow.id,
          designation: formDesignation.trim(),
          hr_username: formHr.trim(),
          target_amount: Number(formTarget),
          month: formMonth,
          year: formYear,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setToast({ type: "error", text: json.error || "Update failed" });
        return;
      }
      setToast({ type: "ok", text: json.message || "Updated" });
      setEditRow(null);
      await loadDashboard();
    } catch (err) {
      setToast({ type: "error", text: err.message || "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row) => {
    setFormDesignation(row.designation || "");
    setFormHr(row.hr_username === "—" ? "" : row.hr_username || "");
    setFormTarget(String(row.target_amount ?? ""));
    setFormMonth(row.month);
    setFormYear(row.year);
    setEditRow(row);
    setToast(null);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this target row?")) return;
    try {
      const res = await fetch(`/api/admin/hr-designation-targets?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setToast({ type: "error", text: json.error || "Delete failed" });
        return;
      }
      await loadDashboard();
    } catch (e) {
      setToast({ type: "error", text: e.message || "Network error" });
    }
  };

  const q = search.trim().toLowerCase();
  const filteredChart = useMemo(() => {
    const chart = dashboard?.chart || [];
    if (!q) return chart;
    return chart.filter(
      (c) =>
        String(c.hr_username || "").toLowerCase().includes(q) ||
        String(c.display_label || "").toLowerCase().includes(q) ||
        String(c.chart_name || "").toLowerCase().includes(q)
    );
  }, [dashboard?.chart, q]);

  const filteredRows = useMemo(() => {
    const rows = dashboard?.rows || [];
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.hr_username || "").toLowerCase().includes(q) ||
        String(r.designation || "").toLowerCase().includes(q)
    );
  }, [dashboard?.rows, q]);

  const monthLabel = MONTHS.find((m) => m.value === month)?.label || month;

  return (
    <div className="min-h-screen bg-gray-50/80 pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Top toolbar */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-6">
          <div className="flex flex-wrap items-end gap-3 sm:gap-4">
            <Link
              href="/admin-dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="min-w-[140px] px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
              <input
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm"
              />
            </div>
            <p className="text-sm text-gray-500 pb-2">
              Showing targets active in {monthLabel} {year}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center w-full lg:w-auto">
            <div className="relative flex-1 lg:min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                placeholder="Search by username…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400"
              />
            </div>
            <button
              type="button"
              onClick={openAdd}
              disabled={!hasHrUsernameColumn}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add targets
            </button>
          </div>
        </div>

        {!hasHrUsernameColumn && (
          <div className="mb-6 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            Per-HR chart needs column <code className="text-xs">hr_username</code>. Run{" "}
            <code className="text-xs break-all">migration_add_hr_username_to_hr_designation_monthly_targets.sql</code>
          </div>
        )}

        {toast && (
          <div
            className={`mb-4 px-4 py-3 rounded-xl text-sm ${
              toast.type === "ok" ? "bg-emerald-50 text-emerald-900 border border-emerald-200" : "bg-red-50 text-red-900 border border-red-200"
            }`}
          >
            {toast.text}
          </div>
        )}

        {/* Chart card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-8 mb-8">
          <h1 className="text-center text-xl sm:text-2xl font-bold text-gray-900">Target vs achieved</h1>
          <p className="text-center text-sm text-gray-500 mt-2 max-w-2xl mx-auto">
            {monthLabel} {year}
          </p>

          <div className="mt-8 h-[380px] w-full min-w-0">
            {loading ? (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">Loading chart…</div>
            ) : !hasHrUsernameColumn ? (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">Run migration to enable chart.</div>
            ) : filteredChart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                No HR targets for this month{q ? " (try clearing search)" : ""}.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredChart}
                  margin={{ top: 16, right: 24, left: 8, bottom: 72 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="chart_name"
                    tick={{ fontSize: 11, fill: "#4b5563" }}
                    interval={0}
                    angle={-40}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis
                    tickFormatter={formatChartAxis}
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    width={56}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: 16 }} />
                  <Bar dataKey="target_total" name="Target" fill="#5c67f2" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Bar
                    dataKey="achieved_total"
                    name="Target achieved"
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Target list</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wide border-b border-gray-200">
                  <th className="text-left font-semibold px-4 py-3">Username</th>
                  <th className="text-left font-semibold px-4 py-3">Designation</th>
                  <th className="text-right font-semibold px-4 py-3">Target</th>
                  <th className="text-right font-semibold px-4 py-3">Achieved</th>
                  <th className="text-center font-semibold px-4 py-3">Start date</th>
                  <th className="text-center font-semibold px-4 py-3">End date</th>
                  <th className="text-left font-semibold px-4 py-3">Assigned by</th>
                  <th className="text-center font-semibold px-4 py-3 w-36">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                      Loading…
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                      No rows for this month{q ? " (try clearing search)" : ""}.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                      <td className="px-4 py-3 text-gray-900 font-medium">{row.hr_username}</td>
                      <td className="px-4 py-3 text-gray-700">{row.designation}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                        {formatTargetPlain(row.target_amount)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-700 font-medium">
                        {formatTargetPlain(row.achieved)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{row.start_date}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{row.end_date}</td>
                      <td className="px-4 py-3 text-gray-600">{row.assigned_by}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setViewRow(row)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(row.id)}
                            className="text-xs text-red-600 hover:underline px-1"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Add target</h3>
              <button type="button" onClick={() => setAddOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={submitAdd} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">HR user *</label>
                <select
                  value={formHr}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormHr(v);
                    const u = hrUsers.find((x) => x.username === v);
                    const sug = u?.suggested_designation?.trim() || "";
                    if (sug) setFormDesignation(sug);
                  }}
                  required
                  disabled={loadingHrUsers}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                >
                  <option value="">{loadingHrUsers ? "Loading…" : "— Select HR —"}</option>
                  {hrUsers.map((u) => (
                    <option key={u.username} value={u.username}>
                      {(u.display_name || u.username).trim()} ({u.username})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation *</label>
                <input
                  type="text"
                  required
                  value={formDesignation}
                  onChange={(e) => setFormDesignation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  placeholder="e.g. SALES EXECUTIVE"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Hiring</label>
                <input
                  type="number"
                  required
                  min={0}
                  step="1"
                  value={formTarget}
                  onChange={(e) => setFormTarget(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                  <select
                    value={formMonth}
                    onChange={(e) => setFormMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={formYear}
                    onChange={(e) => setFormYear(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-900 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Target details</h3>
              <button type="button" onClick={() => setViewRow(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <p>
                <span className="text-gray-500">Username:</span>{" "}
                <span className="font-medium text-gray-900">{viewRow.hr_username}</span>
              </p>
              <p>
                <span className="text-gray-500">Designation:</span>{" "}
                <span className="font-medium text-gray-900">{viewRow.designation}</span>
              </p>
              <p>
                <span className="text-gray-500">Target:</span>{" "}
                <span className="font-medium text-gray-900">{formatTargetPlain(viewRow.target_amount)}</span>
              </p>
              <p>
                <span className="text-gray-500">Achieved:</span>{" "}
                <span className="font-medium text-emerald-700">{formatTargetPlain(viewRow.achieved)}</span>
              </p>
              <p>
                <span className="text-gray-500">Period:</span>{" "}
                <span className="text-gray-900">
                  {viewRow.start_date} – {viewRow.end_date}
                </span>
              </p>
              <p>
                <span className="text-gray-500">Assigned by:</span>{" "}
                <span className="text-gray-900">{viewRow.assigned_by}</span>
              </p>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setViewRow(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit target</h3>
              <button type="button" onClick={() => setEditRow(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={submitEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">HR username *</label>
                <input
                  type="text"
                  required
                  value={formHr}
                  onChange={(e) => setFormHr(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation *</label>
                <input
                  type="text"
                  required
                  value={formDesignation}
                  onChange={(e) => setFormDesignation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target amount *</label>
                <input
                  type="number"
                  required
                  min={0}
                  step="1"
                  value={formTarget}
                  onChange={(e) => setFormTarget(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                  <select
                    value={formMonth}
                    onChange={(e) => setFormMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={formYear}
                    onChange={(e) => setFormYear(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditRow(null)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-900 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
