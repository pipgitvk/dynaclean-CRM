"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

const inputClass =
  "h-9 w-full min-w-[6.5rem] rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200/80";

function timeForInput(hhmmss) {
  if (!hhmmss) return "";
  const s = String(hhmmss).trim();
  const parts = s.split(":");
  if (parts.length < 2) return "";
  return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
}

function emptyDraft() {
  return {
    checkin_time: "",
    break_morning: "",
    break_lunch: "",
    break_evening: "",
    checkout_time: "",
  };
}

export default function EmployeeAttendanceScheduleClient() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/employee-attendance-schedule");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to load");
      const list = data.employees || [];
      setEmployees(list);
      const next = {};
      for (const e of list) {
        next[e.username] = {
          checkin_time: timeForInput(e.checkin_time),
          break_morning: timeForInput(e.break_morning),
          break_lunch: timeForInput(e.break_lunch),
          break_evening: timeForInput(e.break_evening),
          checkout_time: timeForInput(e.checkout_time),
        };
      }
      setDrafts(next);
    } catch (err) {
      toast.error(err.message || "Load failed");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (username, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [username]: { ...(prev[username] || emptyDraft()), [field]: value },
    }));
  };

  const saveRow = async (username) => {
    const d = drafts[username] || emptyDraft();
    setSaving((s) => ({ ...s, [username]: true }));
    try {
      const res = await fetch("/api/admin/employee-attendance-schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          checkin_time: d.checkin_time || null,
          break_morning: d.break_morning || null,
          break_lunch: d.break_lunch || null,
          break_evening: d.break_evening || null,
          checkout_time: d.checkout_time || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Save failed");
      toast.success(`Saved — ${username}`);
      await load();
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving((s) => ({ ...s, [username]: false }));
    }
  };

  if (loading) {
    return (
      <p className="text-sm text-slate-600">Loading active employees…</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <p className="mb-4 text-sm text-slate-600">
        Set expected check-in, break start times, and checkout for each active employee.
        Empty fields are stored as unset (tracker uses defaults until you save times).
      </p>
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-700">
              Employee
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-700">
              Check-in
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-700">
              Break (morning)
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-700">
              Break (lunch)
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-700">
              Break (evening)
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-700">
              Checkout
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-700 w-28">
              &nbsp;
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {employees.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                No active employees found.
              </td>
            </tr>
          ) : (
            employees.map((e) => {
              const d = drafts[e.username] || emptyDraft();
              const busy = !!saving[e.username];
              return (
                <tr key={e.username} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-slate-900">{e.username}</div>
                    <div className="text-xs text-slate-500">{e.userRole}</div>
                  </td>
                  {["checkin_time", "break_morning", "break_lunch", "break_evening", "checkout_time"].map(
                    (field) => (
                      <td key={field} className="px-3 py-2 align-top">
                        <input
                          type="time"
                          className={inputClass}
                          value={d[field]}
                          onChange={(ev) => setField(e.username, field, ev.target.value)}
                          disabled={busy}
                        />
                      </td>
                    )
                  )}
                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => saveRow(e.username)}
                      disabled={busy}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
