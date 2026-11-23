"use client";

import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import WarrantyDispatchItemLabel from "@/components/warranty/WarrantyDispatchItemLabel";
import { useState } from "react";
import toast from "react-hot-toast";

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
  "Ladakh (38)",
];

export default function WarrantyRegistrationFormCard({
  title,
  itemMeta = null,
  initialForm = {},
  onRegistered,
  onRemove,
  showRemove = false,
}) {
  const [form, setForm] = useState(initialForm);
  const [invoiceFile, setInvoiceFile] = useState();
  const [reports, setReports] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const resetCard = () => {
    setForm(initialForm);
    setInvoiceFile(undefined);
    setReports([]);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ""));
      fd.set("quantity", "1");
      if (invoiceFile) fd.append("invoice", invoiceFile);
      Array.from(reports || []).forEach((r) => fd.append("service_reports", r));

      const res = await fetch("/api/warranty/register", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (data.success) {
        const label =
          itemMeta?.product_name ||
          form.product_name ||
          title ||
          "Product";
        toast.success(`Registered: ${label}`);
        onRegistered?.();
      } else {
        toast.error("Error: " + (data.error || "Registration failed"));
      }
    } catch (err) {
      console.error(err);
      toast.error("Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {itemMeta ? (
              <WarrantyDispatchItemLabel
                productName={itemMeta.product_name}
                model={itemMeta.model}
                serialNumber={itemMeta.serial_number}
                customerName={itemMeta.customer_name}
                itemKind={itemMeta.item_kind}
              />
            ) : (
              <h3 className="text-lg font-semibold text-gray-800">
                {title || "Product Warranty Registration"}
              </h3>
            )}
          </div>
          {showRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="shrink-0 rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <div className="p-6">
      <form
        onSubmit={submit}
        encType="multipart/form-data"
        className="grid grid-cols-1 gap-5 sm:grid-cols-2"
      >
        <input
          name="product_name"
          value={form.product_name || ""}
          onChange={handleChange}
          placeholder="Product Name"
          required
          className="input-sleek rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
        />
        <input
          name="model"
          value={form.model || ""}
          onChange={handleChange}
          placeholder="Model"
          className="input-sleek rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
        />
        <textarea
          name="specification"
          value={form.specification || ""}
          onChange={handleChange}
          placeholder="Specification"
          rows={1}
          className="input-sleek resize-none rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
        />
        <input
          name="serial_number"
          value={form.serial_number || ""}
          onChange={handleChange}
          placeholder="Serial Number"
          className="input-sleek rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
        />
        <input
          name="gstin"
          value={form.gstin || ""}
          onChange={handleChange}
          placeholder="GST Number"
          className="input-sleek rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
        />
        <input
          name="warranty_period"
          type="number"
          value={form.warranty_period || ""}
          onChange={handleChange}
          placeholder="Warranty Period (months)"
          required
          className="input-sleek rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
        />
        <input name="quantity" type="hidden" value="1" readOnly />
        <input
          name="customer_name"
          value={form.customer_name || ""}
          onChange={handleChange}
          placeholder="Customer / Company Name"
          required
          className="input-sleek rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
        />
        <input
          name="email"
          type="email"
          value={form.email || ""}
          onChange={handleChange}
          placeholder="Company Email"
          required
          className="input-sleek rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
        />
        <input
          name="contact_person"
          value={form.contact_person || ""}
          onChange={handleChange}
          placeholder="Contact Person Name"
          required
          className="input-sleek rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
        />
        <input
          name="contact"
          value={form.contact || ""}
          onChange={handleChange}
          placeholder="Company Phone Number"
          required
          className="input-sleek rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
        />
        <textarea
          name="customer_address"
          value={form.customer_address || ""}
          onChange={handleChange}
          placeholder="Company Address"
          rows={1}
          className="input-sleek resize-none rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
        />
        <select
          name="state"
          value={form.state || ""}
          onChange={handleChange}
          className="input-sleek rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
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
          className="input-sleek rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
        />
        <TypeableDateFilterInput
          value={form.invoice_date || ""}
          onChange={(v) =>
            handleChange({ target: { name: "invoice_date", value: v } })
          }
          className="input-sleek rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
        />

        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-600">
            Upload Invoice
          </label>
          <input
            type="file"
            name="invoice"
            accept=".pdf,.jpg,.png"
            onChange={(e) => setInvoiceFile(e.target.files?.[0])}
            className="input-sleek file:rounded file:border-none file:bg-blue-50 file:px-4 file:py-1 file:text-sm file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-600">
            Upload Proof of Delivery
          </label>
          <input
            type="file"
            name="service_reports"
            accept=".pdf,.jpg,.png"
            multiple
            onChange={(e) => setReports(e.target.files)}
            className="input-sleek file:rounded file:border-none file:bg-blue-50 file:px-4 file:py-1 file:text-sm file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <div className="mt-2 flex flex-col justify-between gap-4 sm:col-span-2 sm:flex-row">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-blue-600 px-6 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
          >
            {submitting ? "Saving..." : "Register Product"}
          </button>
          <button
            type="button"
            onClick={resetCard}
            className="w-full rounded-md border border-gray-300 px-6 py-2 font-medium text-gray-700 transition hover:bg-gray-100 sm:w-auto"
          >
            Reset
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}