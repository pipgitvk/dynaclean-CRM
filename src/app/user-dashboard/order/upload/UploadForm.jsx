"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

const MAX_FILES_PER_FIELD = 5;
const FILE_FIELD_NAMES = new Set([
  "ewaybill_file",
  "einvoice_file",
  "report_file",
  "deliverchallan",
]);

export default function UploadForm({ orderDetails }) {
  const [form, setForm] = useState({
    invoice_number: "",
    duedate: "",
    baseAmount: "",
    taxamt: "",
    totalamt: "",
    remark: "",
    ewaybill_file: [],
    einvoice_file: [],
    report_file: [],
    deliverchallan: [],
    payment_id: "",
    payment_date: "",
    payment_amount: "",
  });
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [quoteTotalsLoaded, setQuoteTotalsLoaded] = useState(false);
  const [paymentTermDays, setPaymentTermDays] = useState(null);
  const [computedPaymentStatus, setComputedPaymentStatus] = useState("pending");

  useEffect(() => {
    // Clear alert message once base amount is entered
    if (form.baseAmount) {
      setMessage("");
    }
  }, [form.baseAmount]);

  // Fetch amounts from quotation items using quote_number
  useEffect(() => {
    const quoteNumber = orderDetails?.quote_number;
    if (!quoteNumber || quoteTotalsLoaded) return;

    (async () => {
      try {
        const res = await fetch(`/api/quotations/${quoteNumber}`);
        const data = await res.json();
        if (!res.ok || !data?.items) return;

        const items = data.items;
        // total_taxable_amt = base amount (always correct), fallback to taxable_price
        const taxableSum = items.reduce(
          (acc, it) => acc + Number(it.total_taxable_amt || it.taxable_price || 0),
          0
        );
        // Tax = total - base (most reliable for both old and new data)
        const taxSum = items.reduce(
          (acc, it) => acc + (Number(it.total_price || 0) - Number(it.total_taxable_amt || it.taxable_price || 0)),
          0
        );
        const totalSum = taxableSum + taxSum;

        setForm((prev) => ({
          ...prev,
          baseAmount: taxableSum.toFixed(2),
          taxamt: taxSum.toFixed(2),
          totalamt: totalSum.toFixed(2),
        }));
        if (typeof data.payment_term_days !== "undefined") {
          setPaymentTermDays(Number(data.payment_term_days) || 0);
        }
        setQuoteTotalsLoaded(true);
      } catch (e) {
        // silent fail; user can still enter manually
      }
    })();
  }, [orderDetails?.quote_number, quoteTotalsLoaded]);

  // Compute payment status automatically
  useEffect(() => {
    // Determine due date = invoice date + term days
    const invoiceDateStr = form.duedate; // labeled Invoice Date
    const term = Number(paymentTermDays) || 0;
    let isOverdue = false;
    if (invoiceDateStr && term > 0) {
      const invoiceDate = new Date(invoiceDateStr);
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + term);
      const today = new Date();
      // Compare only yyyy-mm-dd
      isOverdue = today.setHours(0, 0, 0, 0) > dueDate.setHours(0, 0, 0, 0);
    }

    const paidAmt = Number(form.payment_amount) || 0;
    const total = Number(form.totalamt) || 0;
    let status = "pending";
    if (paidAmt >= total && total >= 0) status = "paid";
    else if (paidAmt > 0 && paidAmt < total) status = "partially paid";
    else if (paidAmt === 0 && isOverdue) status = "over due";
    else status = "pending";

    setComputedPaymentStatus(status);
  }, [form.payment_amount, form.duedate, paymentTermDays, form.totalamt]);

  const fileKey = (file) => `${file.name}-${file.size}-${file.lastModified}`;

  const handleRemoveFile = (fieldName, index) => {
    setForm((prev) => ({
      ...prev,
      [fieldName]: prev[fieldName].filter((_, i) => i !== index),
    }));
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (files && FILE_FIELD_NAMES.has(name)) {
      const selected = Array.from(files);
      setForm((prev) => {
        const existing = prev[name] || [];
        const seen = new Set(existing.map(fileKey));
        const newFiles = selected.filter((f) => !seen.has(fileKey(f)));
        const combined = [...existing, ...newFiles];

        if (combined.length > MAX_FILES_PER_FIELD) {
          toast.error(`Maximum ${MAX_FILES_PER_FIELD} files allowed per field`);
          return { ...prev, [name]: combined.slice(0, MAX_FILES_PER_FIELD) };
        }
        return { ...prev, [name]: combined };
      });
      e.target.value = "";
    } else if (files) {
      setForm((prev) => ({ ...prev, [name]: files[0] }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }

    // Real-time validation for baseAmount, taxamt, and totalamt
    if (name === "taxamt" && !form.baseAmount) {
      toast.error("❌ Please enter the Base Amount first.");
    }
    if (name === "totalamt" && !form.taxamt) {
      toast.error("❌ Please enter the Tax Amount first.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    // Check if base amount, tax amount, and total amount are filled correctly
    if (!form.baseAmount) {
      setMessage("❌ Please enter the Base Amount first.");
      setLoading(false);
      return;
    }
    if (!form.taxamt) {
      setMessage("❌ Please enter the Tax Amount.");
      setLoading(false);
      return;
    }
    if (!form.totalamt) {
      setMessage("❌ Please enter the Total Amount.");
      setLoading(false);
      return;
    }
    if (!form.report_file?.length) {
      setMessage("❌ Please upload at least one Invoice PDF.");
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("order_id", orderDetails.order_id);
    for (const key in form) {
      const value = form[key];
      if (!value) continue;
      if (Array.isArray(value)) {
        value.forEach((file) => formData.append(key, file));
      } else {
        formData.append(key, value);
      }
    }

    try {
      const res = await fetch("/api/orders/upload", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (res.ok) {
        setMessage("✅ Files uploaded successfully.");
        router.push("/user-dashboard/order");
      } else {
        setMessage("❌ " + result.error);
      }
    } catch (err) {
      setMessage("❌ Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 max-w-6xl mx-auto p-6 bg-white rounded-lg"
      encType="multipart/form-data"
    >
      {message && (
        <div className="text-center text-sm font-medium text-red-600">
          {message}
        </div>
      )}

      {/* Readonly fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ReadOnlyInput label="Quotation Number" value={orderDetails.quote_number} />
        <ReadOnlyInput label="Client Name" value={orderDetails.client_name} />
        <ReadOnlyInput label="Contact" value={orderDetails.contact} />
        <ReadOnlyInput label="Email" value={orderDetails.email} />
        <ReadOnlyInput
          label="Delivery Location"
          value={orderDetails.delivery_location}
        />
        <ReadOnlyInput
          label="Client Delivery Date"
          value={orderDetails.client_delivery_date ? new Date(orderDetails.client_delivery_date).toLocaleDateString("en-IN") : "-"}
        />
      </div>

      {/* Editable Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <TextInput
          name="invoice_number"
          label="Invoice Number"
          value={form.invoice_number}
          onChange={handleChange}
          required
        />
        <TextInput
          name="duedate"
          label="Invoice Date"
          type="date"
          value={form.duedate}
          onChange={handleChange}
          required
        />
        <TextInput
          name="payment_id"
          label="Payment ID (UTR No)"
          value={form.payment_id}
          onChange={handleChange}
          placeholder="Enter UTR No"
        />
        <TextInput
          name="payment_date"
          label="Payment Date"
          type="date"
          value={form.payment_date}
          onChange={handleChange}
        />
        <TextInput
          name="payment_amount"
          label="Payment Amount"
          type="number"
          value={form.payment_amount}
          onChange={handleChange}
        />
        <ReadOnlyInput label="Payment Status" value={computedPaymentStatus} />
        <TextInput
          name="baseAmount"
          label="Taxable Amount"
          type="number"
          value={form.baseAmount}
          onChange={handleChange}
          required
        />
        <TextInput
          name="taxamt"
          label="Tax Amount"
          type="number"
          value={form.taxamt}
          onChange={handleChange}
          required={form.baseAmount !== ""}
        />
        <TextInput
          name="totalamt"
          label="Total Amount"
          type="number"
          value={form.totalamt}
          onChange={handleChange}
          required={form.taxamt !== ""}
        />
        <TextArea
          name="remark"
          label="Remark *"
          value={form.remark}
          onChange={handleChange}
          required
        />
      </div>

      {/* File Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <FileInput
          name="ewaybill_file"
          label="E-way Bill (Optional)"
          files={form.ewaybill_file}
          onChange={handleChange}
          onRemove={handleRemoveFile}
        />
        <FileInput
          name="einvoice_file"
          label="E-invoice (Optional)"
          files={form.einvoice_file}
          onChange={handleChange}
          onRemove={handleRemoveFile}
        />
        <FileInput
          name="report_file"
          label="Invoice PDF (Required)"
          files={form.report_file}
          required
          onChange={handleChange}
          onRemove={handleRemoveFile}
        />
        <FileInput
          name="deliverchallan"
          label="Delivery Challan (Optional)"
          files={form.deliverchallan}
          onChange={handleChange}
          onRemove={handleRemoveFile}
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <button
          type="submit"
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition"
          disabled={loading}
        >
          {loading ? "Uploading..." : "Upload Files"}
        </button>
        <a
          href="/user-dashboard/order"
          className="text-sm text-gray-600 hover:text-gray-800 underline"
        >
          ← Back to Order List
        </a>
      </div>
    </form>
  );
}

// Reusable Components
function TextInput({ label, name, value, onChange, type = "text", required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        value={value}
        onChange={onChange}
        className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function FileInput({
  label,
  name,
  onChange,
  onRemove,
  required = false,
  files = [],
}) {
  const atMax = files.length >= MAX_FILES_PER_FIELD;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type="file"
        name={name}
        accept=".pdf,.jpg,.jpeg,.png"
        multiple
        onChange={onChange}
        disabled={atMax}
        required={required && files.length === 0}
        className="w-full border border-gray-300 rounded file:mr-4 file:py-1 file:px-3 file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {files.length > 0 && (
        <ul className="mt-1 space-y-1 text-xs text-gray-600">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center justify-between gap-2 rounded bg-gray-50 px-2 py-1"
            >
              <span className="truncate">
                {index + 1}. {file.name}
              </span>
              <button
                type="button"
                onClick={() => onRemove(name, index)}
                className="shrink-0 text-red-600 hover:text-red-800"
                title="Remove file"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TextArea({ label, name, value, onChange, required = false }) {
  return (
    <div className="md:col-span-2 lg:col-span-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <textarea
        name={name}
        value={value}
        required={required}
        onChange={onChange}
        className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={3}
      />
    </div>
  );
}

function ReadOnlyInput({ label, value }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value || ""}
        readOnly
        className="w-full border border-gray-200 bg-gray-100 rounded px-3 py-2 text-gray-700"
      />
    </div>
  );
}
