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
import {
  HR_TARGET_ALLOWED_DESIGNATIONS,
  mergeDesignationOptions,
  resolveCanonicalDesignation,
} from "@/lib/designationDedupe";

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
  const [designationOptions, setDesignationOptions] = useState([]);
  const [loadingDesignations, setLoadingDesignations] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);
  const [editRow, setEditRow] = useState(null);

  const [formDesignation, setFormDesignation] = useState("");
  const [formHr, setFormHr] = useState("");
  const [formCity, setFormCity] = useState("");
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingDesignations(true);
      try {
        const res = await fetch("/api/admin/employee-designations", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.success) setDesignationOptions(Array.isArray(json.designations) ? json.designations : []);
      } catch {
        if (!cancelled) setDesignationOptions([]);
      } finally {
        if (!cancelled) setLoadingDesignations(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestedDesignationForFormHr = useMemo(() => {
    const u = hrUsers.find((x) => x.username === formHr);
    return u?.suggested_designation?.trim() || "";
  }, [hrUsers, formHr]);

  const normalizeDesignationKey = useCallback((s) => String(s).trim().toLowerCase().replace(/\s+/g, " "), []);
  const allowedDesignationKeyToLabel = useMemo(() => {
    const m = new Map();
    for (const d of HR_TARGET_ALLOWED_DESIGNATIONS) {
      m.set(normalizeDesignationKey(d), d);
    }
    return m;
  }, [normalizeDesignationKey]);

  const toAllowedDesignationLabel = useCallback(
    (raw) => {
      const t = String(raw ?? "").trim();
      if (!t) return "";
      return allowedDesignationKeyToLabel.get(normalizeDesignationKey(t)) || "";
    },
    [allowedDesignationKeyToLabel, normalizeDesignationKey]
  );

  const addModalDesignations = useMemo(
    () => HR_TARGET_ALLOWED_DESIGNATIONS,
    []
  );

  const editModalDesignations = useMemo(
    () => mergeDesignationOptions(designationOptions, editRow?.designation, formDesignation),
    [designationOptions, editRow?.designation, formDesignation]
  );

  const openAdd = () => {
    setFormMonth(month);
    setFormYear(year);
    setFormDesignation("");
    setFormHr("");
    setFormCity("");
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
          city: formCity.trim(),
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
          city: formCity.trim(),
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
    setFormDesignation(resolveCanonicalDesignation(row.designation, designationOptions));
    setFormHr(row.hr_username === "—" ? "" : row.hr_username || "");
    setFormCity(String(row.city || "").trim());
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
        String(r.designation || "").toLowerCase().includes(q) ||
        String(r.city || "").toLowerCase().includes(q)
    );
  }, [dashboard?.rows, q]);

  const monthLabel = MONTHS.find((m) => m.value === month)?.label || month;

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-50/80 pb-[max(3rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
        {/* Top toolbar */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-end gap-3 sm:gap-4">
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
            <p className="w-full pb-2 text-xs text-gray-500 sm:w-auto sm:text-sm">
              Showing targets active in {monthLabel} {year}
            </p>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
            <div className="relative min-w-0 flex-1 lg:min-w-[240px]">
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
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-8">
          <h1 className="text-center text-lg font-bold text-gray-900 sm:text-xl md:text-2xl">Target vs achieved</h1>
          <p className="mx-auto mt-2 max-w-2xl text-center text-xs text-gray-500 sm:text-sm">
            {monthLabel} {year}
          </p>

          <div className="mt-5 h-[min(48vh,340px)] w-full min-w-0 sm:mt-8 sm:h-[380px]">
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
                  margin={{ top: 12, right: 8, left: 4, bottom: 64 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="chart_name"
                    tick={{ fontSize: 10, fill: "#4b5563" }}
                    interval={0}
                    angle={-38}
                    textAnchor="end"
                    height={68}
                  />
                  <YAxis
                    tickFormatter={formatChartAxis}
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    width={48}
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
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 sm:px-5 sm:py-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-700 sm:text-sm">Target list</h2>
          </div>
          <div className="touch-pan-x overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
            <table className="min-w-[720px] w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-100 text-[10px] font-semibold uppercase tracking-wide text-gray-700 sm:text-xs">
                  <th className="whitespace-nowrap px-2 py-2.5 text-left sm:px-4 sm:py-3">Username</th>
                  <th className="min-w-[7rem] px-2 py-2.5 text-left sm:px-4 sm:py-3">Designation</th>
                  <th className="min-w-[6rem] px-2 py-2.5 text-left sm:px-4 sm:py-3">City</th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right sm:px-4 sm:py-3">Target</th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right sm:px-4 sm:py-3">Achieved</th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-center sm:px-4 sm:py-3">Start date</th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-center sm:px-4 sm:py-3">End date</th>
                  <th className="min-w-[6rem] px-2 py-2.5 text-left sm:px-4 sm:py-3">Assigned by</th>
                  <th className="w-28 whitespace-nowrap px-2 py-2.5 text-center sm:w-36 sm:px-4 sm:py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                      Loading…
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                      No rows for this month{q ? " (try clearing search)" : ""}.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                      <td className="px-2 py-2.5 font-medium text-gray-900 sm:px-4 sm:py-3">{row.hr_username}</td>
                      <td className="max-w-[10rem] truncate px-2 py-2.5 text-gray-700 sm:max-w-none sm:px-4 sm:py-3" title={row.designation}>
                        {row.designation}
                      </td>
                      <td className="max-w-[9rem] truncate px-2 py-2.5 text-gray-700 sm:max-w-none sm:px-4 sm:py-3" title={row.city || ""}>
                        {row.city || "—"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-gray-900 sm:px-4 sm:py-3">
                        {formatTargetPlain(row.target_amount)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right font-medium tabular-nums text-emerald-700 sm:px-4 sm:py-3">
                        {formatTargetPlain(row.achieved)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-center text-gray-600 sm:px-4 sm:py-3">{row.start_date}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-center text-gray-600 sm:px-4 sm:py-3">{row.end_date}</td>
                      <td className="max-w-[8rem] truncate px-2 py-2.5 text-gray-600 sm:max-w-none sm:px-4 sm:py-3" title={row.assigned_by}>
                        {row.assigned_by}
                      </td>
                      <td className="px-2 py-2.5 sm:px-4 sm:py-3">
                        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
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
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-transparent"
            onClick={() => setAddOpen(false)}
            aria-label="Close dialog"
          />
          <div className="relative z-10 max-h-[min(92dvh,100%)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:max-h-[90vh] sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:py-4">
              <h3 className="text-base font-semibold text-gray-900 sm:text-lg">Add target</h3>
              <button type="button" onClick={() => setAddOpen(false)} className="rounded-lg p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={submitAdd} className="space-y-4 p-4 sm:p-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">HR user *</label>
                <select
                  value={formHr}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormHr(v);
                    const u = hrUsers.find((x) => x.username === v);
                    const sug = u?.suggested_designation?.trim() || "";
                    const allowed = toAllowedDesignationLabel(sug);
                    if (allowed) setFormDesignation(allowed);
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
                <select
                  required
                  value={formDesignation}
                  onChange={(e) => setFormDesignation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                >
                  <option value="">— Select designation —</option>
                  {addModalDesignations.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder="Optional — use different cities to add another row for the same role"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  maxLength={120}
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
                  <label className="mb-1 block text-sm font-medium text-gray-700">Month</label>
                  <select
                    value={formMonth}
                    onChange={(e) => setFormMonth(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base sm:py-2 sm:text-sm"
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Year</label>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={formYear}
                    onChange={(e) => setFormYear(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base sm:py-2 sm:text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:pb-0 sm:pt-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="w-full min-h-[44px] rounded-lg border border-gray-300 py-2.5 text-gray-700 hover:bg-gray-50 sm:w-auto sm:min-h-0 sm:px-4 sm:py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full min-h-[44px] rounded-lg bg-slate-800 py-2.5 font-medium text-white hover:bg-slate-900 disabled:opacity-50 sm:w-auto sm:min-h-0 sm:px-5 sm:py-2"
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
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-transparent"
            onClick={() => setViewRow(null)}
            aria-label="Close dialog"
          />
          <div className="relative z-10 max-h-[min(90dvh,100%)] w-full max-w-md overflow-y-auto rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:max-h-[85vh] sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:py-4">
              <h3 className="text-base font-semibold text-gray-900 sm:text-lg">Target details</h3>
              <button type="button" onClick={() => setViewRow(null)} className="rounded-lg p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3 p-4 text-sm sm:p-5">
              <p>
                <span className="text-gray-500">Username:</span>{" "}
                <span className="font-medium text-gray-900">{viewRow.hr_username}</span>
              </p>
              <p>
                <span className="text-gray-500">Designation:</span>{" "}
                <span className="font-medium text-gray-900">{viewRow.designation}</span>
              </p>
              <p>
                <span className="text-gray-500">City:</span>{" "}
                <span className="font-medium text-gray-900">{viewRow.city || "—"}</span>
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
            <div className="flex justify-end border-t border-gray-200 px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4 sm:pb-4">
              <button
                type="button"
                onClick={() => setViewRow(null)}
                className="min-h-[44px] w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white sm:min-h-0 sm:w-auto sm:py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editRow && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-transparent"
            onClick={() => setEditRow(null)}
            aria-label="Close dialog"
          />
          <div className="relative z-10 max-h-[min(92dvh,100%)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:max-h-[90vh] sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:py-4">
              <h3 className="text-base font-semibold text-gray-900 sm:text-lg">Edit target</h3>
              <button type="button" onClick={() => setEditRow(null)} className="rounded-lg p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={submitEdit} className="space-y-4 p-4 sm:p-5">
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
                <select
                  required
                  value={formDesignation}
                  onChange={(e) => setFormDesignation(e.target.value)}
                  disabled={loadingDesignations}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                >
                  <option value="">{loadingDesignations ? "Loading designations…" : "— Select designation —"}</option>
                  {editModalDesignations.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  maxLength={120}
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
                  <label className="mb-1 block text-sm font-medium text-gray-700">Month</label>
                  <select
                    value={formMonth}
                    onChange={(e) => setFormMonth(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base sm:py-2 sm:text-sm"
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Year</label>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={formYear}
                    onChange={(e) => setFormYear(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base sm:py-2 sm:text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:pb-0 sm:pt-2">
                <button
                  type="button"
                  onClick={() => setEditRow(null)}
                  className="w-full min-h-[44px] rounded-lg border border-gray-300 py-2.5 text-gray-700 hover:bg-gray-50 sm:w-auto sm:min-h-0 sm:px-4 sm:py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full min-h-[44px] rounded-lg bg-slate-800 py-2.5 font-medium text-white hover:bg-slate-900 disabled:opacity-50 sm:w-auto sm:min-h-0 sm:px-5 sm:py-2"
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
