"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dayjs from "dayjs";

export default function EditExpensePage() {
  const { expenseId } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState([]);

  useEffect(() => {
    const fetchExpense = async () => {
      try {
        const res = await fetch(`/api/get-expense-details/${expenseId}`);
        const data = await res.json();
        const row = data?.[0] || {};
        setForm({
          TravelDate: row.TravelDate
            ? dayjs(row.TravelDate).format("YYYY-MM-DD")
            : "",
          FromLocation: row.FromLocation || "",
          Tolocation: row.Tolocation || "",
          distance: row.distance || 0,
          person_name: row.person_name || "",
          person_contact: row.person_contact || "",
          ConveyanceMode: row.ConveyanceMode || "",
          TicketCost: row.TicketCost || 0,
          HotelCost: row.HotelCost || 0,
          MealsCost: row.MealsCost || 0,
          OtherExpenses: row.OtherExpenses || 0,
          description: row.description || "",
        });

        // Handle existing attachments
        if (row.attachments) {
          const attachmentList = row.attachments.split(", ").filter(Boolean);
          setExistingAttachments(attachmentList);
        }
      } catch (e) {
        setError("Failed to load expense");
      } finally {
        setLoading(false);
      }
    };
    fetchExpense();
  }, [expenseId]);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "attachments") {
      setAttachments(Array.from(files));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const removeExistingAttachment = (index) => {
    setExistingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const formData = new FormData();

      // Add form fields
      for (const key in form) {
        formData.append(key, form[key]);
      }

      // Add new attachments
      attachments.forEach((file) => {
        formData.append("attachments", file);
      });

      // Add existing attachments (as comma-separated string)
      formData.append("existingAttachments", existingAttachments.join(", "));

      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: "PUT",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to update expense");
      router.push(`/admin-dashboard/expenses/${expenseId}`);
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-xl font-semibold mb-4">Edit Expense #{expenseId}</h1>
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <div>
          <label className="block text-sm mb-1">Expense Date</label>
          <input
            name="TravelDate"
            type="date"
            value={form.TravelDate}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">From Location</label>
          <input
            name="FromLocation"
            value={form.FromLocation}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">To Location</label>
          <input
            name="Tolocation"
            value={form.Tolocation}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Distance (km)</label>
          <input
            name="distance"
            type="number"
            value={form.distance}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Meeting Person Name</label>
          <input
            name="person_name"
            value={form.person_name}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Person Contact</label>
          <input
            name="person_contact"
            value={form.person_contact}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Conveyance Mode</label>
          <input
            name="ConveyanceMode"
            value={form.ConveyanceMode}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Ticket Cost</label>
          <input
            name="TicketCost"
            type="number"
            value={form.TicketCost}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Hotel Cost</label>
          <input
            name="HotelCost"
            type="number"
            value={form.HotelCost}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Meals Cost</label>
          <input
            name="MealsCost"
            type="number"
            value={form.MealsCost}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Other Expenses</label>
          <input
            name="OtherExpenses"
            type="number"
            value={form.OtherExpenses}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />
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

        {/* Existing Attachments */}
        {existingAttachments.length > 0 && (
          <div className="sm:col-span-2">
            <label className="block text-sm mb-1">Existing Attachments</label>
            <div className="space-y-2">
              {existingAttachments.map((attachment, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 p-2 rounded"
                >
                  <span className="text-sm text-gray-700">
                    {attachment.split("/").pop()}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeExistingAttachment(index)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New Attachments */}
        <div className="sm:col-span-2">
          <label className="block text-sm mb-1">Add New Attachments</label>
          <input
            name="attachments"
            type="file"
            multiple
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />
          {attachments.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-gray-600">Selected files:</p>
              <ul className="text-sm text-gray-700">
                {attachments.map((file, index) => (
                  <li key={index}>• {file.name}</li>
                ))}
              </ul>
            </div>
          )}
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
            className="px-4 py-2 bg-yellow-600 text-white rounded"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
