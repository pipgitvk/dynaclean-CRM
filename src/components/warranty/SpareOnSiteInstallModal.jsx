"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";

export default function SpareOnSiteInstallModal({ spare, onClose, onSuccess }) {
  const [repList, setRepList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    installation_address: spare?.customer_address || "",
    site_person: spare?.contact_person || "",
    site_email: spare?.email || "",
    site_contact: String(spare?.contact || ""),
    username: "",
  });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    fetch("/api/reps")
      .then((r) => r.json())
      .then((d) => setRepList(d.users || []))
      .catch(() => setRepList([]));
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/warranty/spare-installation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registered_spare_id: spare.id,
          serial_number: spare.serial_number,
          order_id: spare.order_id,
          quote_number: spare.quote_number,
          spare_item_code: spare.spare_item_code || spare.model,
          spare_item_name: spare.spare_item_name || spare.product_name,
          customer_name: spare.customer_name,
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to submit");
        return;
      }
      toast.success("Installation request submitted!");
      onSuccess?.();
      onClose();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b bg-white px-6 py-4">
          <h2 className="text-xl font-bold text-gray-800">
            Add New Installation Request
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800"
          >
            <X size={22} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
            <div className="font-semibold">
              {spare?.product_name || spare?.spare_item_name}
            </div>
            {spare?.order_id ? (
              <div>Order: {spare.order_id}</div>
            ) : null}
            <div>
              Serial: {String(spare?.serial_number || "").trim() || "—"}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Service Type</label>
            <select
              disabled
              className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2"
            >
              <option>INSTALLATION</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">
              Installation Address
            </label>
            <input
              type="text"
              name="installation_address"
              value={form.installation_address}
              onChange={handleChange}
              placeholder="Enter complete address"
              required
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Site Person Name</label>
            <input
              type="text"
              name="site_person"
              value={form.site_person}
              onChange={handleChange}
              required
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Site Person Email</label>
            <input
              type="email"
              name="site_email"
              value={form.site_email}
              onChange={handleChange}
              required
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Site Person Contact</label>
            <input
              type="tel"
              name="site_contact"
              value={form.site_contact}
              onChange={handleChange}
              required
              pattern="[0-9+ -]{7,15}"
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Assign to User</label>
            <select
              name="username"
              value={form.username}
              onChange={handleChange}
              required
              className="w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="">-- Select User --</option>
              {repList.map((rep) => (
                <option key={rep.username} value={rep.username}>
                  {rep.username}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-green-600 py-2 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
}