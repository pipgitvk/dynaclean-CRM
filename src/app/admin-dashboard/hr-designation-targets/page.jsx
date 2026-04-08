"use client";

import { useCallback, useEffect, useState } from "react";

export default function HrDesignationTargetsPage() {
  const now = new Date();
  const [designation, setDesignation] = useState("");
  const [hr_username, setHrUsername] = useState("");
  const [target_amount, setTargetAmount] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [targets, setTargets] = useState([]);
  const [hasHrUsernameColumn, setHasHrUsernameColumn] = useState(false);
  const [hrUsers, setHrUsers] = useState([]);
  const [loadingHrUsers, setLoadingHrUsers] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/hr-designation-targets?year=${filterYear}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setTargets(json.targets || []);
        setHasHrUsernameColumn(Boolean(json.hasHrUsernameColumn));
      } else setMessage({ type: "error", text: json.error || "Failed to load" });
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Network error" });
    } finally {
      setLoading(false);
    }
  }, [filterYear]);

  useEffect(() => {
    load();
  }, [load]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (hasHrUsernameColumn && !hr_username.trim()) {
      setMessage({ type: "error", text: "Please select an HR user from the dropdown." });
      return;
    }
    if (!designation.trim()) {
      setMessage({
        type: "error",
        text: "Designation is required (it may auto-fill when you pick an HR user).",
      });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/hr-designation-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designation: designation.trim(),
          hr_username: hr_username.trim(),
          target_amount: Number(target_amount),
          month,
          year,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Save failed" });
        return;
      }
      setMessage({ type: "ok", text: json.message || "Saved" });
      setDesignation("");
      setHrUsername("");
      setTargetAmount("");
      load();
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this target row?")) return;
    try {
      const res = await fetch(`/api/admin/hr-designation-targets?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Delete failed" });
        return;
      }
      load();
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Network error" });
    }
  };

  const monthName = (m) =>
    [
      "",
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ][m] || m;

  const showHrUsernameCol = hasHrUsernameColumn;

  return (
    <div className="container mx-auto p-4 sm:p-8 max-w-4xl">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">HR designation targets</h1>
      <p className="text-gray-600 mb-4">
        <strong>Select an HR user</strong> below (only HR / HR HEAD / HR Executive are listed). Enter the target amount
        and month–year. The target will appear on that user&apos;s dashboard. Designation may auto-fill from their
        profile—edit it if needed.
      </p>
      {!hasHrUsernameColumn && (
        <p className="text-xs text-red-900 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-6">
          To enable per-HR targets, run this database migration first:{" "}
          <code className="text-xs break-all">migration_add_hr_username_to_hr_designation_monthly_targets.sql</code>
        </p>
      )}

      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            message.type === "ok" ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"
          }`}
        >
          {message.text}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow border border-gray-100 p-6 mb-8 space-y-4"
      >
        <h2 className="font-semibold text-gray-800">Add or update target</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select HR <span className="text-red-600">*</span>
            </label>
            <select
              value={hr_username}
              onChange={(e) => {
                const v = e.target.value;
                setHrUsername(v);
                const u = hrUsers.find((x) => x.username === v);
                const sug = u?.suggested_designation?.trim() || "";
                if (sug) setDesignation(sug);
              }}
              required={hasHrUsernameColumn}
              disabled={loadingHrUsers || !hasHrUsernameColumn}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100"
            >
              <option value="">
                {loadingHrUsers
                  ? "Loading…"
                  : hasHrUsernameColumn
                    ? "— Select HR —"
                    : "— Run DB migration first —"}
              </option>
              {hrUsers.map((u) => (
                <option key={u.username} value={u.username}>
                  {(u.display_name || u.username).trim()} ({u.username}) — {u.userRole}
                </option>
              ))}
            </select>
            {!loadingHrUsers && hasHrUsernameColumn && hrUsers.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">
                No active HR / HR HEAD / HR Executive users found in rep_list.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Designation <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. DEVELOPER"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target amount</label>
            <input
              type="number"
              required
              min={0}
              step="1"
              value={target_amount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {monthName(m)} ({m})
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
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving || !hasHrUsernameColumn}
          className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save target"}
        </button>
      </form>

      <div className="flex items-center gap-4 mb-4">
        <label className="text-sm font-medium text-gray-700">Filter list by year</label>
        <input
          type="number"
          className="w-28 px-3 py-2 border border-gray-300 rounded-lg"
          value={filterYear}
          onChange={(e) => setFilterYear(Number(e.target.value) || now.getFullYear())}
        />
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-500">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Designation</th>
                  {showHrUsernameCol && (
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">HR username</th>
                  )}
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Month</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Year</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Target</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700" />
                </tr>
              </thead>
              <tbody>
                {targets.length === 0 ? (
                  <tr>
                    <td colSpan={showHrUsernameCol ? 6 : 5} className="px-4 py-8 text-center text-gray-500">
                      No targets for this year yet.
                    </td>
                  </tr>
                ) : (
                  targets.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                      <td className="px-4 py-3 text-gray-900">{row.designation}</td>
                      {showHrUsernameCol && (
                        <td className="px-4 py-3 text-gray-700">
                          {row.hr_username ? row.hr_username : "—"}
                        </td>
                      )}
                      <td className="px-4 py-3">{monthName(row.month)}</td>
                      <td className="px-4 py-3">{row.year}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {Number(row.target_amount).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          className="text-red-600 hover:underline text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
