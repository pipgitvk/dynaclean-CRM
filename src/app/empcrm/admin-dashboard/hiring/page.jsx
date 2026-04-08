"use client";

import { useCallback, useEffect, useState } from "react";

export default function HiringPage() {
  const now = new Date();
  const [candidate_name, setCandidateName] = useState("");
  const [designation, setDesignation] = useState("");
  const [hire_date, setHireDate] = useState(now.toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState("");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/empcrm/hiring?year=${filterYear}`;
      if (filterMonth) url += `&month=${filterMonth}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (json.success) setEntries(json.entries || []);
      else setMessage({ type: "error", text: json.error || "Failed to load" });
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Network error" });
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterMonth]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/empcrm/hiring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_name, designation, hire_date, note }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Save failed" });
        return;
      }
      setMessage({ type: "ok", text: json.message || "Saved" });
      setCandidateName("");
      setNote("");
      load();
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Remove this hire record?")) return;
    try {
      const res = await fetch(`/api/empcrm/hiring?id=${id}`, { method: "DELETE" });
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hiring</h1>
        <p className="text-gray-600 text-sm mt-1">
          Log new hires by <strong>designation</strong> (must match the designation on the target Superadmin set for
          you). Each hire in the selected month adds <strong>1</strong> to your dashboard &quot;Target vs
          completed&quot; completed total for that designation.
        </p>
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${
            message.type === "ok" ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"
          }`}
        >
          {message.text}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4"
      >
        <h2 className="font-semibold text-gray-800">Add hire</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Candidate name *</label>
            <input
              required
              value={candidate_name}
              onChange={(e) => setCandidateName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Designation *</label>
            <input
              required
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="Same as target (e.g. DEVELOPER)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hire date *</label>
            <input
              type="date"
              required
              value={hire_date}
              onChange={(e) => setHireDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save hire"}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Year</label>
        <input
          type="number"
          className="w-28 px-3 py-2 border rounded-lg"
          value={filterYear}
          onChange={(e) => setFilterYear(Number(e.target.value) || now.getFullYear())}
        />
        <label className="text-sm font-medium text-gray-700">Month</label>
        <select
          className="px-3 py-2 border rounded-lg bg-white"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
        >
          <option value="">All months</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-500">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Candidate</th>
                  <th className="text-left px-4 py-3 font-semibold">Designation</th>
                  <th className="text-left px-4 py-3 font-semibold">Hire date</th>
                  <th className="text-left px-4 py-3 font-semibold">Note</th>
                  <th className="text-right px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No hires for this filter.
                    </td>
                  </tr>
                ) : (
                  entries.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100">
                      <td className="px-4 py-3">{row.candidate_name}</td>
                      <td className="px-4 py-3">{row.designation}</td>
                      <td className="px-4 py-3">{String(row.hire_date).slice(0, 10)}</td>
                      <td className="px-4 py-3 text-gray-600">{row.note || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          className="text-red-600 text-xs hover:underline"
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
