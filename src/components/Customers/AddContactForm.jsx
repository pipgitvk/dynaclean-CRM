"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

export default function AddContactForm({ customerId, existingContacts, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    designation: "",
    report_to: "",
    working: 1
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "working" ? parseInt(value) : value
    }));
    if (name === "contact") setDuplicateWarning("");
  };

  const checkPhoneDuplicate = async (phone) => {
    if (!phone || String(phone).replace(/\D/g, "").length < 10) return;
    try {
      const res = await fetch(`/api/check-phone?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (data.duplicate) {
        setDuplicateWarning(
          `Duplicate: This number exists${data.customerId ? ` (Customer ID: ${data.customerId})` : ""}`
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
      if (formData.contact) checkPhoneDuplicate(formData.contact);
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.contact]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const designationVal = (formData.designation || "").trim() || null;
    const reportToVal = formData.report_to && String(formData.report_to).trim()
      ? parseInt(formData.report_to, 10)
      : null;

    try {
      const response = await fetch("/api/customer-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          name: formData.name.trim(),
          contact: formData.contact,
          designation: designationVal,
          report_to: reportToVal,
          working: formData.working ?? 1,
        })
      });

      const data = await response.json();

      if (data.success) {
        setFormData({
          name: "",
          contact: "",
          designation: "",
          report_to: "",
          working: 1
        });
        onSuccess();
      } else {
        const errMsg = data.error ||
          (data.duplicate ? `Duplicate phone number${data.existingCustomerId ? ` (Customer ID: ${data.existingCustomerId})` : ""}` : "Failed to add contact");
        setError(data.detail ? `${errMsg}: ${data.detail}` : errMsg);
      }
    } catch (err) {
      console.error("Error adding contact:", err);
      setError("Failed to add contact");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 sm:p-6 shadow-md">
      <div className="flex justify-between items-center mb-4 gap-2">
        <h3 className="text-base sm:text-xl font-semibold text-gray-800">Add New Contact</h3>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        )}
      </div>

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
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="contact"
              value={formData.contact}
              onChange={handleChange}
              required
              placeholder="10 digits"
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
              {existingContacts?.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name} ({contact.designation || "No designation"})
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
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {loading ? "Adding..." : "Add Contact"}
          </button>
        </div>
      </form>
    </div>
  );
}
