"use client";
import { useState, useMemo } from "react";
import { useUser } from "@/context/UserContext";
import OrderPoDateField from "@/components/orders/OrderPoDateField";
import OrderFormProductsSection, {
  orderFormQuotationHideGst,
} from "@/components/orders/OrderFormProductsSection";

export default function OrderForm({ quotation, reset }) {
  const { user } = useUser();
  const isGemRole = user?.userRole === "GEM";
  const [formData, setFormData] = useState({
    ...quotation,
    paymentProofFiles: [],
    poFiles: [],
    salesRemark: "",
    clientDeliveryDate: "",
    poNumber: "",
    paymentDate: "",
    orderDate: "",
    transactionId: "",
    paymentAmount: "",
  });
  const [hasPO, setHasPO] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentProofPreviews, setPaymentProofPreviews] = useState([]);
  const [poFilePreviews, setPoFilePreviews] = useState([]);

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
  const hideTaxColumns = orderFormQuotationHideGst(quotation);

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

  // Handle multiple payment proof uploads
  const handlePaymentProofChange = (e) => {
    const files = Array.from(e.target.files);
    setFormData((fd) => ({ ...fd, paymentProofFiles: files }));
    
    // Generate previews
    const previews = files.map((file) => ({
      name: file.name,
      size: (file.size / 1024).toFixed(2),
      type: file.type,
      url: URL.createObjectURL(file),
    }));
    setPaymentProofPreviews(previews);
  };

  // Handle multiple PO file uploads
  const handlePoFileChange = (e) => {
    const files = Array.from(e.target.files);
    setFormData((fd) => ({ ...fd, poFiles: files }));
    
    // Generate previews
    const previews = files.map((file) => ({
      name: file.name,
      size: (file.size / 1024).toFixed(2),
      type: file.type,
      url: URL.createObjectURL(file),
    }));
    setPoFilePreviews(previews);
  };

  // Remove payment proof file
  const removePaymentProofFile = (index) => {
    setFormData((fd) => ({
      ...fd,
      paymentProofFiles: fd.paymentProofFiles.filter((_, i) => i !== index),
    }));
    const newPreviews = paymentProofPreviews.filter((_, i) => i !== index);
    setPaymentProofPreviews(newPreviews);
  };

  // Remove PO file
  const removePoFile = (index) => {
    setFormData((fd) => ({
      ...fd,
      poFiles: fd.poFiles.filter((_, i) => i !== index),
    }));
    const newPreviews = poFilePreviews.filter((_, i) => i !== index);
    setPoFilePreviews(newPreviews);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    const fd = new FormData();
    const skipFormKeys = new Set(["items", "payment_amount"]);
    for (const key in formData) {
      if (skipFormKeys.has(key)) continue;
      if (key === "paymentProofFiles" || key === "poFiles") {
        // Handle arrays of files
        if (formData[key].length > 0) {
          formData[key].forEach((file, idx) => {
            fd.append(key, file);
          });
        }
      } else if (formData[key] !== null) {
        fd.append(key, formData[key]);
      }
    }
    // Include computed duedate
    if (computedDueDateISO) fd.append("duedate", computedDueDateISO);
    if (formData.orderDate) fd.append("order_date", formData.orderDate);

    // Add first product's data from quotation items
    if (quotation.items && quotation.items.length > 0) {
      const firstItem = quotation.items[0];
      fd.append("item_name", firstItem.item_name || "");
      fd.append("item_code", firstItem.item_code || "");
      fd.append("specification", firstItem.specification || "");
      fd.append("quantity", firstItem.quantity || "");
      fd.append("unit", firstItem.unit || "");
      fd.append("price_per_unit", firstItem.price_per_unit || "");
      if (!hideTaxColumns) {
        fd.append(
          "taxable_price",
          firstItem.taxable_price ?? firstItem.total_taxable_amt ?? "",
        );
        fd.append("gst", firstItem.gst ?? "");
      }
      fd.append("total_price", firstItem.total_price || "");
      fd.append("img_url", firstItem.img_url || "");
    }

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
          <OrderPoDateField
            value={formData.orderDate}
            onChange={(v) => setFormData((fd) => ({ ...fd, orderDate: v }))}
          />
          {isGemRole && (
            <div>
              <label className="block font-medium mb-1">PO Number / Gem Order Number *</label>
              <input
                type="text"
                required
                value={formData.poNumber}
                onChange={(e) =>
                  setFormData((fd) => ({ ...fd, poNumber: e.target.value }))
                }
                className="w-full px-3 py-2 border rounded bg-white"
              />
            </div>
          )}
          <div>
            <label className="block font-medium mb-1">Payment Date *</label>
            <input
              type="date"
              required
              value={formData.paymentDate}
              onChange={(e) =>
                setFormData((fd) => ({ ...fd, paymentDate: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded bg-white"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Transaction ID *</label>
            <input
              type="text"
              required
              value={formData.transactionId}
              onChange={(e) =>
                setFormData((fd) => ({ ...fd, transactionId: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded bg-white"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Payment Amount *</label>
            <input
              type="number"
              step="0.01"
              required
              name="paymentAmount"
              value={formData.paymentAmount}
              onChange={(e) =>
                setFormData((fd) => ({ ...fd, paymentAmount: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded bg-white"
            />
          </div>
        </div>
      </section>

      {/* Product Table or Card */}
      <section className="bg-gray-50 p-4 rounded shadow">
        <h2 className="font-semibold mb-4 text-lg">Products</h2>
        <OrderFormProductsSection
          items={quotation.items}
          hideTaxColumns={hideTaxColumns}
        />
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
              <label className="block font-medium mb-1">PO Files * (Multiple)</label>
              <input
                type="file"
                required
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handlePoFileChange}
                className="w-full mb-2"
              />
              <p className="text-xs text-gray-500 mb-2">Upload images, PDFs, or documents</p>
              
              {/* PO Files Preview */}
              {poFilePreviews.length > 0 && (
                <div className="mt-2 space-y-2">
                  <p className="font-semibold text-sm">Uploaded PO Files:</p>
                  <div className="space-y-1">
                    {poFilePreviews.map((preview, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-100 p-2 rounded">
                        <div className="flex-1">
                          <p className="text-xs font-medium truncate">{preview.name}</p>
                          <p className="text-xs text-gray-600">{preview.size} KB</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePoFile(idx)}
                          className="ml-2 text-red-600 hover:text-red-800 font-medium text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="block font-medium mb-1">Payment Proof * (Multiple)</label>
          <input
            type="file"
            required
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={handlePaymentProofChange}
            className="w-full mb-2"
          />
          <p className="text-xs text-gray-500 mb-2">Upload images, PDFs, or documents</p>
          
          {/* Payment Proof Files Preview */}
          {paymentProofPreviews.length > 0 && (
            <div className="mt-2 space-y-2">
              <p className="font-semibold text-sm">Uploaded Payment Proofs:</p>
              <div className="space-y-1">
                {paymentProofPreviews.map((preview, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-100 p-2 rounded">
                    <div className="flex-1">
                      <p className="text-xs font-medium truncate">{preview.name}</p>
                      <p className="text-xs text-gray-600">{preview.size} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePaymentProofFile(idx)}
                      className="ml-2 text-red-600 hover:text-red-800 font-medium text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
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
