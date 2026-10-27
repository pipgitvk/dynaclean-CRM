"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function HolidaysAdminPage() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", holiday_date: "", description: "" });

  const fetchHolidays = async () => {
    try {
      const res = await fetch("/api/holidays");
      const data = await res.json();
      setHolidays(data.holidays || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load holidays");
    }
  };

  useEffect(() => { fetchHolidays(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          holiday_date: form.holiday_date,
          description: form.description?.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create holiday");
      toast.success("Holiday created");
      setForm({ title: "", holiday_date: "", description: "" });
      fetchHolidays();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Manage Holidays</h1>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded p-4 mb-8 grid gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            value={form.holiday_date}
            onChange={(e) => setForm((f) => ({ ...f, holiday_date: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            className="w-full border rounded px-3 py-2"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className={`px-4 py-2 rounded text-white ${loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {loading ? "Saving..." : "Create Holiday"}
        </button>
      </form>

      <div className="bg-white shadow rounded p-4">
        <h2 className="text-xl font-semibold mb-4">Holiday List</h2>
        {holidays.length === 0 ? (
          <p className="text-gray-500">No holidays yet.</p>
        ) : (
          <ul className="divide-y">
            {holidays.map((h) => (
              <li key={h.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{h.title}</p>
                  <p className="text-sm text-gray-600">{new Date(h.holiday_date).toLocaleDateString()} {h.is_optional ? "(Optional)" : ""}</p>
                  {h.description ? <p className="text-sm text-gray-500">{h.description}</p> : null}
                </div>
                <span className="text-xs text-gray-400">Created by {h.created_by}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
