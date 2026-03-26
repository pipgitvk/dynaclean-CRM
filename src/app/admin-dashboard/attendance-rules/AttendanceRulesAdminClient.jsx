"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

const inputClass =
  "h-9 w-full min-w-[6.5rem] rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200/80";

const numClass =
  "h-9 w-full max-w-[5rem] rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200/80";

function timeForInput(hhmmss) {
  if (!hhmmss) return "";
  const s = String(hhmmss).trim();
  const parts = s.split(":");
  if (parts.length < 2) return "";
  return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
}

const emptyForm = () => ({
  checkin: "09:30:00",
  checkout: "18:30:00",
  gracePeriodMinutes: 15,
  halfDayCheckin: "10:00:00",
  halfDayCheckout: "18:14:00",
  break_morning_start: "11:15:00",
  break_lunch_start: "13:30:00",
  break_evening_start: "17:45:00",
  breakDurations: { morning: 15, lunch: 30, evening: 15 },
  breakGracePeriodMinutes: 5,
});

/** Map API row from employee_attendance_schedule (+ rep_list) to form state */
function scheduleRowToForm(row) {
  if (!row?.username) return null;
  const base = emptyForm();
  const t = (v, fallback) => {
    if (v == null || v === "") return fallback;
    const s = String(v).trim();
    if (s.length === 5 && s[2] === ":") return `${s}:00`;
    if (s.length >= 8) return s.slice(0, 8);
    return `${s}:00`.slice(0, 8);
  };
  return {
    checkin: t(row.checkin_time, base.checkin),
    checkout: t(row.checkout_time, base.checkout),
    gracePeriodMinutes: row.grace_period_minutes ?? base.gracePeriodMinutes,
    halfDayCheckin: t(row.half_day_checkin_time, base.halfDayCheckin),
    halfDayCheckout: t(row.half_day_checkout_time, base.halfDayCheckout),
    break_morning_start: t(row.break_morning, base.break_morning_start),
    break_lunch_start: t(row.break_lunch, base.break_lunch_start),
    break_evening_start: t(row.break_evening, base.break_evening_start),
    breakDurations: {
      morning: row.morning_duration_minutes ?? base.breakDurations.morning,
      lunch: row.lunch_duration_minutes ?? base.breakDurations.lunch,
      evening: row.evening_duration_minutes ?? base.breakDurations.evening,
    },
    breakGracePeriodMinutes: row.break_grace_period_minutes ?? base.breakGracePeriodMinutes,
  };
}

export default function AttendanceRulesAdminClient({
  onRulesChanged,
  editEmployeeRow = null,
} = {}) {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [empLoadError, setEmpLoadError] = useState(null);
  const [empSearch, setEmpSearch] = useState("");
  const [selectedUsernames, setSelectedUsernames] = useState(() => new Set());
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/attendance-rules", {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to load");
      const r = data.rules;
      if (r) {
        setForm({
          checkin: r.checkin,
          checkout: r.checkout,
          gracePeriodMinutes: r.gracePeriodMinutes,
          halfDayCheckin: r.halfDayCheckin,
          halfDayCheckout: r.halfDayCheckout,
          break_morning_start: r.break_morning_start,
          break_lunch_start: r.break_lunch_start,
          break_evening_start: r.break_evening_start,
          breakDurations: { ...r.breakDurations },
          breakGracePeriodMinutes: r.breakGracePeriodMinutes,
        });
      }
    } catch (e) {
      toast.error(e.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** When editing from table: pre-fill form + select that employee after company rules load */
  useEffect(() => {
    if (loading) return;
    if (!editEmployeeRow?.username) return;
    const mapped = scheduleRowToForm(editEmployeeRow);
    if (mapped) setForm(mapped);
    setSelectedUsernames(new Set([editEmployeeRow.username]));
  }, [loading, editEmployeeRow]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/employees-active", {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Failed to load employees");
        if (!cancelled) {
          setEmployees(data.employees || []);
          setEmpLoadError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setEmployees([]);
          setEmpLoadError(e.message || "Could not load employee list");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredEmployees = employees.filter((e) => {
    const q = empSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(e.username).toLowerCase().includes(q) ||
      String(e.userRole || "").toLowerCase().includes(q) ||
      String(e.email || "").toLowerCase().includes(q)
    );
  });

  /** Rows to show: filter matches + selected users hidden by filter (selection stays visible) */
  const employeeRowsToShow = (() => {
    const byName = new Map();
    for (const e of filteredEmployees) byName.set(e.username, e);
    for (const e of employees) {
      if (selectedUsernames.has(e.username) && !byName.has(e.username)) {
        byName.set(e.username, e);
      }
    }
    return Array.from(byName.values()).sort((a, b) =>
      String(a.username).localeCompare(String(b.username), undefined, { sensitivity: "base" })
    );
  })();

  const toggleEmployee = (username) => {
    setSelectedUsernames((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedUsernames((prev) => {
      const next = new Set(prev);
      for (const e of filteredEmployees) next.add(e.username);
      return next;
    });
  };

  const clearSelection = () => setSelectedUsernames(new Set());

  const applyToSelectedEmployees = async () => {
    if (selectedUsernames.size === 0) {
      toast.error("Select at least one employee.");
      return;
    }
    setApplying(true);
    try {
      const res = await fetch("/api/admin/employee-attendance-schedule/batch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernames: Array.from(selectedUsernames),
          checkin: form.checkin,
          checkout: form.checkout,
          gracePeriodMinutes: form.gracePeriodMinutes,
          halfDayCheckin: form.halfDayCheckin,
          halfDayCheckout: form.halfDayCheckout,
          break_morning_start: form.break_morning_start,
          break_lunch_start: form.break_lunch_start,
          break_evening_start: form.break_evening_start,
          breakDurations: form.breakDurations,
          breakGracePeriodMinutes: form.breakGracePeriodMinutes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Apply failed");
      const skipped = data.skipped?.length ? ` (${data.skipped.length} skipped)` : "";
      toast.success(
        `Saved timings for ${data.applied ?? selectedUsernames.size} employee(s)${skipped}.`
      );
      if (onRulesChanged) {
        await Promise.resolve(onRulesChanged());
      }
    } catch (e) {
      toast.error(e.message || "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/attendance-rules", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Save failed");
      toast.success("Company attendance rules saved.");
      if (data.rules) {
        setForm({
          checkin: data.rules.checkin,
          checkout: data.rules.checkout,
          gracePeriodMinutes: data.rules.gracePeriodMinutes,
          halfDayCheckin: data.rules.halfDayCheckin,
          halfDayCheckout: data.rules.halfDayCheckout,
          break_morning_start: data.rules.break_morning_start,
          break_lunch_start: data.rules.break_lunch_start,
          break_evening_start: data.rules.break_evening_start,
          breakDurations: { ...data.rules.breakDurations },
          breakGracePeriodMinutes: data.rules.breakGracePeriodMinutes,
        });
      }
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-600">Loading rules…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-slate-800">
            Employees (same list as Employee Registry — active only)
          </span>
          <span className="text-xs text-slate-500">
            {selectedUsernames.size} selected
          </span>
        </div>
        <input
          type="search"
          placeholder="Filter list by name, email, role…"
          className="mb-3 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200/80"
          value={empSearch}
          onChange={(e) => setEmpSearch(e.target.value)}
        />
        <div className="mb-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectAllFiltered}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            Add all in filtered list to selection
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            Clear selection
          </button>
        </div>
        {empLoadError ? (
          <p className="text-sm text-amber-700">{empLoadError}</p>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            {employeeRowsToShow.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">
                {employees.length === 0 ? "No active employees" : "No employees match filter"}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {employeeRowsToShow.map((e) => {
                  const checked = selectedUsernames.has(e.username);
                  return (
                    <li key={e.username}>
                      <label
                        className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors ${
                          checked ? "bg-blue-50/90" : "hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/30"
                          checked={checked}
                          onChange={() => toggleEmployee(e.username)}
                        />
                        <span className="min-w-0 flex-1 text-sm leading-snug text-slate-700">
                          <span className="font-medium text-slate-900">{e.username}</span>
                          <span className="text-slate-600"> — {e.userRole || "—"}</span>
                          {e.email ? (
                            <span className="text-slate-500"> ({e.email})</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={applyToSelectedEmployees}
          disabled={applying || selectedUsernames.size === 0}
          className="mt-3 rounded-lg border border-slate-800 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {applying ? "Saving…" : "Apply timings to selected employees"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Standard check-in</span>
          <input
            type="time"
            className={inputClass}
            value={timeForInput(form.checkin)}
            onChange={(e) => setForm((f) => ({ ...f, checkin: `${e.target.value}:00` }))}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Standard checkout</span>
          <input
            type="time"
            className={inputClass}
            value={timeForInput(form.checkout)}
            onChange={(e) => setForm((f) => ({ ...f, checkout: `${e.target.value}:00` }))}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Grace (minutes)</span>
          <input
            type="number"
            min={0}
            max={120}
            className={numClass}
            value={form.gracePeriodMinutes}
            onChange={(e) =>
              setForm((f) => ({ ...f, gracePeriodMinutes: Number(e.target.value) || 0 }))
            }
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Half-day if check-in after</span>
          <input
            type="time"
            className={inputClass}
            value={timeForInput(form.halfDayCheckin)}
            onChange={(e) => setForm((f) => ({ ...f, halfDayCheckin: `${e.target.value}:00` }))}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Half-day if checkout before</span>
          <input
            type="time"
            className={inputClass}
            value={timeForInput(form.halfDayCheckout)}
            onChange={(e) => setForm((f) => ({ ...f, halfDayCheckout: `${e.target.value}:00` }))}
          />
        </label>
      </div>

      <h3 className="text-sm font-semibold text-slate-800">Break windows &amp; durations</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Morning break start", "break_morning_start", "morning"],
          ["Lunch break start", "break_lunch_start", "lunch"],
          ["Evening break start", "break_evening_start", "evening"],
        ].map(([label, key, durKey]) => (
          <div key={key} className="flex flex-wrap items-end gap-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{label}</span>
              <input
                type="time"
                className={inputClass}
                value={timeForInput(form[key])}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [key]: `${e.target.value}:00` }))
                }
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Min</span>
              <input
                type="number"
                min={1}
                max={180}
                className={numClass}
                value={form.breakDurations[durKey]}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    breakDurations: {
                      ...f.breakDurations,
                      [durKey]: Number(e.target.value) || 0,
                    },
                  }))
                }
              />
            </label>
          </div>
        ))}
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Break grace (minutes)</span>
          <input
            type="number"
            min={0}
            max={60}
            className={numClass}
            value={form.breakGracePeriodMinutes}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                breakGracePeriodMinutes: Number(e.target.value) || 0,
              }))
            }
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save company rules (default for everyone)"}
        </button>
      </div>
    </div>
  );
}
