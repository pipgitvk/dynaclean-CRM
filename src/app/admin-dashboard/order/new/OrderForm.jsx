"use client";
import { useState, useMemo } from "react";

export default function OrderForm({ quotation, reset }) {
  const [formData, setFormData] = useState({
    paymentProof: null,
    poFile: null,
    salesRemark: "",
    clientDeliveryDate: "",
    ...quotation,
  });
  const [hasPO, setHasPO] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Compute duedate = today + payment_term_days
  const computedDueDateISO = useMemo(() => {
    const days = Number(quotation.payment_term_days);
    if (!Number.isFinite(days)) return "";
    const today = new Date();
    const due = new Date(today);
    due.setDate(due.getDate() + days);
    return due.toISOString().slice(0, 10);
  }, [quotation.payment_term_days]);

  // Map payment_term_days to readable text
  const paymentTermDays = useMemo(() => {
    const map = {
      "0": "Advance",
      "9": "COD",
      "15": "15 Days",
      "30": "30 Days",
      "45": "45 Days",
      "60": "60 Days",
    };
    return map[quotation.payment_term_days] || quotation.payment_term_days || "";
  }, [quotation.payment_term_days]);

  console.log("this is the quotation: ", quotation);


  async function handleSubmit(e) {
    e.preventDefault();
    const fd = new FormData();
    for (const key in formData) {
      if (formData[key] !== null) fd.append(key, formData[key]);
    }
    // Include computed duedate
    if (computedDueDateISO) fd.append("duedate", computedDueDateISO);

    setSubmitting(true);
    const res = await fetch("/api/orders", { method: "POST", body: fd });
    const json = await res.json();
    setSubmitting(false);

    if (json.success) {
      alert(`Order saved! Order ID: ${json.orderId}`);
      reset();
    } else alert(json.error);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <button
        type="button"
        onClick={reset}
        className="text-blue-600 underline cursor-pointer"
      >
        ← Change Quotation
      </button>

      {/* Quotation Details */}
      <section className="bg-gray-50 p-4 rounded shadow">
        <h2 className="font-semibold mb-4 text-lg">Quotation Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <label className="block font-medium mb-1">Quotation Number</label>
            <input
              value={quotation.quote_number || ""}
              readOnly
              className="w-full px-3 py-2 border rounded bg-gray-100"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">GSTIN</label>
            <input
              value={quotation.gstin || ""}
              readOnly
              className="w-full px-3 py-2 border rounded bg-gray-100"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Payment Term (Days)</label>
            <input
              value={paymentTermDays ?? ""}
              readOnly
              className="w-full px-3 py-2 border rounded bg-gray-100"
            />
          </div>
          {[
            "company_name",
            "company_address",
            "state",
            "ship_to",
            "client_name",
            "phone",
            "email",
            "delivery_location",
          ].map((field) => {
            const isEditable = [
              "client_name",
              "phone",
              "email",
              "delivery_location",
            ].includes(field);
            return (
              <div key={field}>
                <label className="block font-medium mb-1 capitalize">
                  {field.replace(/_/g, " ")}
                </label>
                <input
                  name={field}
                  value={formData[field] || ""}
                  readOnly={!isEditable}
                  onChange={
                    isEditable
                      ? (e) =>
                        setFormData((fd) => ({
                          ...fd,
                          [field]: e.target.value,
                        }))
                      : undefined
                  }
                  className={`w-full px-3 py-2 border rounded ${isEditable ? "bg-white" : "bg-gray-100"
                    }`}
                />
              </div>
            );
          })}
          <div>
            <label className="block font-medium mb-1">Client Delivery Date</label>
            <input
              type="date"
              value={formData.clientDeliveryDate}
              onChange={(e) =>
                setFormData((fd) => ({ ...fd, clientDeliveryDate: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded bg-white"
            />
          </div>
        </div>
      </section>

      {/* Product Table or Card */}
      <section className="bg-gray-50 p-4 rounded shadow">
        <h2 className="font-semibold mb-4 text-lg">Products</h2>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full text-sm table-auto border">
            <thead className="bg-gray-100">
              <tr className="divide-x">
                {[
                  "Image",
                  "Name",
                  "Code",
                  "Spec",
                  "Qty",
                  "Unit",
                  "Price/Unit",
                  "Taxable",
                  "GST",
                  "Total",
                ].map((h) => (
                  <th key={h} className="px-2 py-2 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((i, idx) => (
                <tr key={idx} className="divide-x text-center border-t">
                  <td className="p-2">
                    <img
                      src={i.img_url}
                      className="h-12 mx-auto object-contain"
                    />
                  </td>
                  <td>{i.item_name}</td>
                  <td>{i.item_code}</td>
                  <td>{i.specification}</td>
                  <td>{i.quantity}</td>
                  <td>{i.unit}</td>
                  <td>₹{i.price_per_unit}</td>
                  <td>₹{Number(i.taxable_price).toFixed(2)}</td>
                  <td>₹{Number(i.gst).toFixed(2)}</td>
                  <td>₹{Number(i.total_price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-4">
          {quotation.items.map((i, idx) => (
            <div
              key={idx}
              className="border rounded p-3 shadow-sm bg-white text-sm"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">{i.item_name}</span>
                <img src={i.img_url} className="h-10 w-10 object-contain" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-gray-700">
                <div>
                  <strong>Code:</strong> {i.item_code}
                </div>
                <div>
                  <strong>Spec:</strong> {i.specification}
                </div>
                <div>
                  <strong>Qty:</strong> {i.quantity}
                </div>
                <div>
                  <strong>Unit:</strong> {i.unit}
                </div>
                <div>
                  <strong>Price:</strong> ₹{i.price_per_unit}
                </div>
                <div>
                  <strong>Taxable:</strong> ₹
                  {Number(i.taxable_price).toFixed(2)}
                </div>
                <div>
                  <strong>GST:</strong> ₹{Number(i.gst).toFixed(2)}
                </div>
                <div>
                  <strong>Total:</strong> ₹{Number(i.total_price).toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* File Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block font-medium mb-2">Do you have PO File?</label>
          <div className="flex gap-4 mb-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="hasPO"
                value="yes"
                checked={hasPO === 'yes'}
                onChange={(e) => setHasPO(e.target.value)}
                className="w-4 h-4"
              />
              Yes
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="hasPO"
                value="no"
                checked={hasPO === 'no'}
                onChange={(e) => setHasPO(e.target.value)}
                className="w-4 h-4"
              />
              No
            </label>
          </div>
          {hasPO === 'yes' && (
            <div>
              <label className="block font-medium mb-1">PO File *</label>
              <input
                type="file"
                required
                onChange={(e) =>
                  setFormData((fd) => ({ ...fd, poFile: e.target.files[0] }))
                }
                className="w-full"
              />
            </div>
          )}
        </div>
        <div>
          <label className="block font-medium mb-1">Payment Proof *</label>
          <input
            type="file"
            required
            onChange={(e) =>
              setFormData((fd) => ({ ...fd, paymentProof: e.target.files[0] }))
            }
            className="w-full"
          />
        </div>
      </div>

      {/* Remark */}
      <div>
        <label className="block font-medium mb-1">Remark *</label>
        <textarea
          rows="3"
          required
          onChange={(e) =>
            setFormData((fd) => ({ ...fd, salesRemark: e.target.value }))
          }
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
      >
        {submitting ? "Saving…" : "Save Order"}
      </button>
    </form>
  );
}
