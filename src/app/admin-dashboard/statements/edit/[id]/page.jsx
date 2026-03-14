"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dayjs from "dayjs";
import toast from "react-hot-toast";

export default function EditStatementPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    trans_id: "",
    date: "",
    txn_dated_deb: "",
    cheq_no: "",
    description: "",
    type: "Credit",
    amount: "",
    client_expense_id: "",
  });
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    fetch("/api/client-expenses", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setExpenses(data?.clientExpenses || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchStatement = async () => {
      try {
        const res = await fetch(`/api/statements/${id}`);
        const row = await res.json();
        if (!res.ok) {
          setError("Statement not found");
          return;
        }
        setForm({
          trans_id: row.trans_id || "",
          date: row.date ? dayjs(row.date).format("YYYY-MM-DD") : "",
          txn_dated_deb: row.txn_dated_deb && row.txn_dated_deb !== "0000-00-00" ? dayjs(row.txn_dated_deb).format("YYYY-MM-DD") : "",
          cheq_no: row.cheq_no || "",
          description: row.description || "",
          type: row.type || "Credit",
          amount: row.amount ?? "",
          client_expense_id: row.client_expense_id ? String(row.client_expense_id) : "",
        });
      } catch (e) {
        setError("Failed to load statement");
      } finally {
        setLoading(false);
      }
    };
    fetchStatement();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/statements/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trans_id: form.trans_id,
          date: form.date,
          txn_dated_deb: form.txn_dated_deb || null,
          cheq_no: form.cheq_no || null,
          description: form.description || null,
          type: form.type,
          amount: form.amount,
          client_expense_id: form.client_expense_id ? Number(form.client_expense_id) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      toast.success("Statement updated successfully!");
      router.push("/admin-dashboard/statements");
    } catch (e) {
      setError(e.message || "Failed to save");
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (error && !form.trans_id) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-xl font-semibold mb-4">Edit Statement #{id}</h1>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1">Trans ID *</label>
          <input
            name="trans_id"
            value={form.trans_id}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Date *</label>
          <input
            name="date"
            type="date"
            value={form.date}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Txn Dated Deb</label>
          <input
            name="txn_dated_deb"
            type="date"
            value={form.txn_dated_deb}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Cheq No</label>
          <input
            name="cheq_no"
            value={form.cheq_no}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Type (Credit/Debit) *</label>
          <select
            name="type"
            value={form.type}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
          >
            <option value="Credit">Credit</option>
            <option value="Debit">Debit</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Amount *</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            value={form.amount}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Expense ID</label>
          <select
            name="client_expense_id"
            value={form.client_expense_id}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          >
            <option value="">Select expense</option>
            {expenses.map((e) => (
              <option key={e.id} value={e.id}>
                {e.id} - {e.expense_name || ""} ({e.client_name || ""})
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm mb-1">Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            rows={4}
          />
        </div>
        <div className="sm:col-span-2 flex justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-200 rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-yellow-600 text-white rounded disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
