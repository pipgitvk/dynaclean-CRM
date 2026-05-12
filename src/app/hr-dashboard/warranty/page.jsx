"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Link from "next/link";

export default function WarrantyForm() {
  const [form, setForm] = useState({});
  const [invoiceFile, setInvoiceFile] = useState();
  const [reports, setReports] = useState([]);

  // Mode selection + Order ID flow
  const [mode, setMode] = useState("manual"); // "manual" | "order"
  const [showModeModal, setShowModeModal] = useState(true);
  const [orderId, setOrderId] = useState("");
  const [orderDispatches, setOrderDispatches] = useState([]);
  const [orderError, setOrderError] = useState("");
  const [loadingOrder, setLoadingOrder] = useState(false);

  const STATES = [
    "Andhra Pradesh (28)",
    "Arunachal Pradesh (12)",
    "Assam (18)",
    "Bihar (10)",
    "Chhattisgarh (22)",
    "Goa (30)",
    "Gujarat (24)",
    "Haryana (06)",
    "Himachal Pradesh (02)",
    "Jharkhand (20)",
    "Karnataka (29)",
    "Kerala (32)",
    "Madhya Pradesh (23)",
    "Maharashtra (27)",
    "Manipur (14)",
    "Meghalaya (17)",
    "Mizoram (15)",
    "Nagaland (13)",
    "Odisha (21)",
    "Punjab (03)",
    "Rajasthan (08)",
    "Sikkim (11)",
    "Tamil Nadu (33)",
    "Telangana (36)",
    "Tripura (16)",
    "Uttar Pradesh (09)",
    "Uttarakhand (05)",
    "West Bengal (19)",
    "Delhi (07)",
    "Jammu and Kashmir (01)",
    "Ladakh (38)"
  ];
  

  // Normalize DB state values like "Haryana (06)" to a clean state name
  const normalizeStateFromDb = (rawState) => {
    if (!rawState) return "";
    const trimmed = String(rawState).trim();

    // Exact match first
    if (STATES.includes(trimmed)) return trimmed;

    // Common pattern: "Haryana (06)" -> "Haryana"
    const withoutCode = trimmed.split("(")[0].trim();
    if (STATES.includes(withoutCode)) return withoutCode;

    // Fallback: match by prefix
    const found = STATES.find((s) =>
      trimmed.toLowerCase().startsWith(s.toLowerCase())
    );
    return found || trimmed;
  };

  useEffect(() => {
    setShowModeModal(true);
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
    setForm({});
    setInvoiceFile(undefined);
    setReports([]);
    const el = document.getElementById("warranty-form");
    if (el) el.reset();
  };

  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    // Always set quantity to 1
    fd.set("quantity", "1");
    if (invoiceFile) fd.append("invoice", invoiceFile);
    Array.from(reports).forEach((r) => fd.append("service_reports", r));

    const res = await fetch("/api/warranty/register", {
      method: "POST",
      body: fd,
    });
    const data = await res.json();

    if (data.success) {
      toast.success("Registered!");
      resetForm();
    } else {
      toast.error("Error: " + data.error);
    }
  };

  const fetchByOrderId = async () => {
    const trimmed = orderId.trim();
    if (!trimmed) {
      toast.error("Please enter Order ID");
      return;
    }
    setLoadingOrder(true);
    setOrderError("");
    setOrderDispatches([]);
    try {
      const res = await fetch(`/api/warranty/by-order-id?order_id=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch data for this Order ID");
      }
      setOrderDispatches(data.dispatches || []);
      if (!data.dispatches || data.dispatches.length === 0) {
        setOrderError("No eligible dispatch found for this Order ID.");
      }
    } catch (err) {
      setOrderError(err.message || "Failed to fetch data for this Order ID");
    } finally {
      setLoadingOrder(false);
    }
  };

  const applyDispatchToForm = (d) => {
    setForm((prev) => ({
      ...prev,
      product_name: d.product_name || "",
      model: d.model || "",
      specification: d.specification || "",
      serial_number: d.serial_number || "",
      gstin: d.gstin || "",
      state: normalizeStateFromDb(d.state),
      // quantity is always 1 for user dashboard, handled in submit and hidden field
      customer_name: d.customer_name || "",
      email: d.email || "",
      contact_person: d.contact_person || "",
      contact: d.contact || "",
      customer_address: d.customer_address || "",
      invoice_number: d.invoice_number || "",
      invoice_date: d.invoice_date ? String(d.invoice_date).slice(0, 10) : "",
    }));
    setMode("order");
    setShowModeModal(false);
    toast.success("Filled form from dispatch record");
  };

  return (
    <div className="max-w-7xl mx-auto mt-10 px-4 sm:px-6 lg:px-8">
      {showModeModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-2">Warranty Registration</h3>
            <p className="text-sm text-gray-600 mb-4">
              Choose how you want to register the warranty.
            </p>
            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="warrantyMode"
                  value="manual"
                  checked={mode === "manual"}
                  onChange={() => setMode("manual")}
                />
                <span>Manual (fill form yourself)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="warrantyMode"
                  value="order"
                  checked={mode === "order"}
                  onChange={() => setMode("order")}
                />
                <span>By Order ID (prefill from Dispatch / Quotation)</span>
              </label>
            </div>

            {mode === "order" && (
              <div className="space-y-3 mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="Enter Order ID"
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={fetchByOrderId}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                    disabled={loadingOrder}
                  >
                    {loadingOrder ? "Searching..." : "Search"}
                  </button>
                </div>
                {orderError && (
                  <p className="text-xs text-red-600">{orderError}</p>
                )}
                {orderDispatches.length > 0 && (
                  <div className="border rounded-md max-h-52 overflow-y-auto text-sm">
                    {orderDispatches.map((d) => (
                      <button
                        type="button"
                        key={d.dispatch_id}
                        onClick={() => applyDispatchToForm(d)}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0"
                      >
                        <div className="font-medium text-gray-800">
                          {d.product_name} ({d.model})
                        </div>
                        <div className="text-xs text-gray-600">
                          Serial: {d.serial_number}  b7 Customer: {d.customer_name}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-2">
              <button
                type="button"
                onClick={() => setShowModeModal(false)}
                className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                {mode === "manual" ? "Continue with Manual" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className=" rounded-xl p-8 sm:p-10 border border-gray-100 relative z-10">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h2 className="text-2xl sm:text-3xl text-gray-800 sm:text-center md:text-start">
            Product Warranty Registration
          </h2>
          <div className="flex flex-wrap gap-3 justify-end">
            <button
              type="button"
              onClick={() => {
                setMode("order");
                setShowModeModal(true);
              }}
              className="inline-flex items-center bg-white border border-blue-600 text-blue-700 rounded-lg px-4 py-2 text-sm hover:bg-blue-50"
            >
              Fill from Order ID
            </button>
            <Link
              href="/user-dashboard/warranty/products"
              className="inline-block bg-gradient-to-r from-blue-600 to-indigo-600
            text-white rounded-lg px-5 py-3 shadow-md
            hover:shadow-xl hover:scale-105 transition-all duration-300"
            >
              Show Products
            </Link>
          </div>
        </div>

        <form
          id="warranty-form"
          onSubmit={submit}
          encType="multipart/form-data"
          className="grid grid-cols-1 sm:grid-cols-2 gap-5 bg-white p-6 rounded-lg "
        >
          {/* Inputs */}
          <input
            name="product_name"
            value={form.product_name || ""}
            onChange={handleChange}
            placeholder="Product Name"
            required
            className="input-sleek border border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-md p-2"
          />
          <input
            name="model"
            value={form.model || ""}
            onChange={handleChange}
            placeholder="Model"
            className="input-sleek border border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-md p-2"
          />
          <textarea
            name="specification"
            value={form.specification || ""}
            onChange={handleChange}
            placeholder="Specification"
            rows={1}
            className="input-sleek resize-none border border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-md p-2"
          />
          <input
            name="serial_number"
            value={form.serial_number || ""}
            onChange={handleChange}
            placeholder="Serial Number"
            className="input-sleek border border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-md p-2"
          />
          <input
            name="gstin"
            value={form.gstin || ""}
            onChange={handleChange}
            placeholder="GST Number"
            className="input-sleek border border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-md p-2"
          />
          {/* quantity is always 1 for user */}
          <input
            name="quantity"
            type="hidden"
            value="1"
            readOnly
          />
          <input
            name="warranty_period"
            type="number"
            value={form.warranty_period || ""}
            onChange={handleChange}
            placeholder="Warranty Period (months)"
            required
            className="input-sleek border border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-md p-2"
          />
          <input
            name="customer_name"
            value={form.customer_name || ""}
            onChange={handleChange}
            placeholder="Customer / Company Name"
            required
            className="input-sleek border border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-md p-2"
          />
          <input
            name="email"
            type="email"
            value={form.email || ""}
            onChange={handleChange}
            placeholder="Company Email"
            required
            className="input-sleek border border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-md p-2"
          />
          <input
            name="contact_person"
            value={form.contact_person || ""}
            onChange={handleChange}
            placeholder="Contact Person Name"
            required
            className="input-sleek border border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-md p-2"
          />
          <input
            name="contact"
            value={form.contact || ""}
            onChange={handleChange}
            placeholder="Company Phone Number"
            required
            className="input-sleek border border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-md p-2"
          />
          <textarea
            name="customer_address"
            value={form.customer_address || ""}
            onChange={handleChange}
            placeholder="Company Address"
            rows={1}
            className="input-sleek resize-none border border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-md p-2"
          />
          <select
            name="state"
            value={form.state || ""}
            onChange={handleChange}
            className="input-sleek border border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-md p-2"
          >
            <option value="">Select State</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            name="invoice_number"
            value={form.invoice_number || ""}
            onChange={handleChange}
            placeholder="Invoice Number"
            className="input-sleek border border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-md p-2"
          />
          <input
            name="invoice_date"
            type="date"
            value={form.invoice_date || ""}
            onChange={handleChange}
            className="input-sleek border border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-md p-2"
          />

          {/* File Inputs */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Upload Invoice
            </label>
            <input
              type="file"
              name="invoice"
              accept=".pdf,.jpg,.png"
              onChange={(e) => setInvoiceFile(e.target.files[0])}
              className="input-sleek file:bg-blue-50 file:border-none file:px-4 file:py-1 file:rounded file:text-sm file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Upload Proof of Delivery
            </label>
            <input
              type="file"
              name="service_reports"
              accept=".pdf,.jpg,.png"
              multiple
              onChange={(e) => setReports(e.target.files)}
              className="input-sleek file:bg-blue-50 file:border-none file:px-4 file:py-1 file:rounded file:text-sm file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* Action Buttons */}
          <div className="sm:col-span-2 flex flex-col sm:flex-row gap-4 justify-between mt-6">
            <button
              type="submit"
              className="w-full sm:w-auto bg-blue-600 text-white font-medium px-6 py-2 rounded-md hover:bg-blue-700 transition cursor-pointer"
            >
              Register Product
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="w-full sm:w-auto border border-gray-300 text-gray-700 font-medium px-6 py-2 rounded-md hover:bg-gray-100 transition"
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
