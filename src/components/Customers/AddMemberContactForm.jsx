"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

export default function AddMemberContactForm({
  parentCustomerId,
  basePath = "user-dashboard",
  onSuccess,
  onCancel,
  existingContacts = [],
}) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    company: "",
    designation: "",
    address: "",
    products_interest: "",
    tags: "",
    notes: "",
    report_to: "",
    working: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "working" ? parseInt(value, 10) : value,
    }));
    if (name === "phone") setDuplicateWarning("");
  };

  const checkPhoneDuplicate = async (phone) => {
    if (!phone || String(phone).replace(/\D/g, "").length < 10) return;
    try {
      const res = await fetch(
        `/api/check-phone?phone=${encodeURIComponent(phone)}`
      );
      const data = await res.json();
      if (data.duplicate) {
        setDuplicateWarning(
          `Duplicate: This number exists (${data.source === "customers" ? "Customer ID: " + data.customerId : "in contacts"})`
        );
      } else {
        setDuplicateWarning("");
      }
    } catch {
      setDuplicateWarning("");
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.phone) checkPhoneDuplicate(formData.phone);
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.phone]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/add-member-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_customer_id: parentCustomerId,
          ...formData,
          report_to: formData.report_to || null,
          working: formData.working,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setFormData({
          first_name: "",
          last_name: "",
          phone: "",
          email: "",
          company: "",
          designation: "",
          address: "",
          products_interest: "",
          tags: "",
          notes: "",
          report_to: "",
          working: 1,
        });
        onSuccess(data.customerId);
      } else {
        const suffix = data.existingCustomerId ? ` (Customer ID: ${data.existingCustomerId})` : "";
        const errMsg = data.error ||
          (data.duplicate ? "Duplicate phone number" + suffix : "Failed to add member");
        setError(errMsg);
      }
    } catch (err) {
      console.error("Error adding member:", err);
      setError("Failed to add member contact");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 sm:p-6 shadow-md">
      <div className="flex justify-between items-center mb-4 gap-2">
        <h3 className="text-base sm:text-xl font-semibold text-gray-800">
          Add Member Contact (Creates New Customer)
        </h3>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        )}
      </div>

      <p className="text-sm text-gray-600 mb-4">
        This creates a new customer with a new Customer ID, linked to this
        customer in the hierarchy.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {duplicateWarning && (
        <div className="mb-4 p-3 bg-amber-100 text-amber-800 rounded-md">
          {duplicateWarning}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              placeholder="10 digits"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company
            </label>
            <input
              type="text"
              name="company"
              value={formData.company}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Designation
            </label>
            <input
              type="text"
              name="designation"
              value={formData.designation}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reports To
            </label>
            <select
              name="report_to"
              value={formData.report_to}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- None (Top Level) --</option>
              {existingContacts?.map((c) => (
                <option key={c.id} value={c.id}>
                  {(c.name || [c.first_name, c.last_name].filter(Boolean).join(" "))} ({c.designation || "No designation"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              name="working"
              value={formData.working}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>Working</option>
              <option value={0}>Not Working</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Products Interest
            </label>
            <input
              type="text"
              name="products_interest"
              value={formData.products_interest}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !!duplicateWarning}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:bg-purple-300 disabled:cursor-not-allowed"
          >
            {loading ? "Adding..." : "Add Member (New Customer)"}
          </button>
        </div>
      </form>
    </div>
  );
}
