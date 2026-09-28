"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { manualPaymentInvoiceHref } from "@/lib/manualPaymentInvoiceHref";

const INPUT =
  "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500";

function toDateInput(value) {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return text.includes("T") ? text.split("T")[0] : "";
}

export default function EditPaymentPage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingReceivedId, setSavingReceivedId] = useState(null);
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    amount: "",
    payment_type: "partial",
    payment_method: "cash",
    reference_number: "",
    payment_date: "",
    due_date: "",
    status: "pending",
    remarks: "",
  });
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [newInvoiceFile, setNewInvoiceFile] = useState(null);
  const [removeInvoice, setRemoveInvoice] = useState(false);
  const [auditInfo, setAuditInfo] = useState(null);
  const [receivedPayments, setReceivedPayments] = useState([]);
  const [totalReceived, setTotalReceived] = useState(0);
  const [showReceivedModal, setShowReceivedModal] = useState(false);
  const [submittingReceived, setSubmittingReceived] = useState(false);
  const [receivedForm, setReceivedForm] = useState({
    payment_date: "",
    reference_number: "",
    amount: "",
    attachment: null,
  });

  useEffect(() => {
    fetchPaymentData();
    fetchReceivedPayments();
  }, [id]);

  const fetchPaymentData = async () => {
    try {
      const res = await fetch(`/api/manual-payment-pending/${id}`);
      const data = await res.json();

      if (data.success) {
        const payment = data.data;
        setFormData({
          customer_name: payment.customer_name || "",
          customer_phone: payment.customer_phone || "",
          customer_email: payment.customer_email || "",
          amount: payment.amount || "",
          payment_type: payment.payment_type || "partial",
          payment_method: payment.payment_method || "cash",
          reference_number: payment.reference_number || "",
          payment_date: toDateInput(payment.payment_date),
          due_date: toDateInput(payment.due_date),
          status: payment.status || "pending",
          remarks: payment.remarks || "",
        });
        setCurrentInvoice(payment.invoice_file);
        setNewInvoiceFile(null);
        setRemoveInvoice(false);
        setAuditInfo({
          created_by: payment.created_by,
          created_at: payment.created_at,
          modified_by: payment.modified_by,
          modified_at: payment.modified_at,
        });
      } else {
        alert("Payment entry not found");
        router.push("/accounts-dashboard/manual-payments");
      }
    } catch (error) {
      console.error("Fetch error:", error);
      alert("Failed to load payment entry");
    } finally {
      setLoading(false);
    }
  };

  const fetchReceivedPayments = async () => {
    try {
      const res = await fetch(`/api/manual-payment-pending/${id}/received`);
      const data = await res.json();
      if (data.success) {
        setReceivedPayments(
          (data.data || []).map((row) => ({
            ...row,
            payment_date: toDateInput(row.payment_date),
            newAttachment: null,
          })),
        );
        setTotalReceived(Number(data.total_received || 0));
        if (data.status) {
          setFormData((prev) => ({ ...prev, status: data.status }));
        }
      }
    } catch (error) {
      console.error("Fetch received payments error:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formDataToSend = new FormData();
      Object.keys(formData).forEach((key) => {
        formDataToSend.append(key, formData[key]);
      });
      if (newInvoiceFile) formDataToSend.append("invoice_file", newInvoiceFile);
      if (removeInvoice) formDataToSend.append("remove_invoice", "true");

      const res = await fetch(`/api/manual-payment-pending/${id}`, {
        method: "PUT",
        body: formDataToSend,
      });
      const data = await res.json();

      if (data.success) {
        alert("Payment entry updated successfully!");
        await fetchPaymentData();
        await fetchReceivedPayments();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Update error:", error);
      alert("Failed to update payment entry");
    } finally {
      setSubmitting(false);
    }
  };

  const updateReceivedRow = (rowId, patch) => {
    setReceivedPayments((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  };

  const saveReceivedRow = async (row) => {
    setSavingReceivedId(row.id);
    try {
      const body = new FormData();
      body.append("payment_date", row.payment_date || "");
      body.append("reference_number", row.reference_number || "");
      body.append("amount", row.amount ?? "");
      if (row.newAttachment) body.append("attachment", row.newAttachment);

      const res = await fetch(
        `/api/manual-payment-pending/${id}/received/${row.id}`,
        { method: "PUT", body },
      );
      const data = await res.json();
      if (!data.success) {
        alert(`Error: ${data.error}`);
        return;
      }
      if (data.status) {
        setFormData((prev) => ({ ...prev, status: data.status }));
      }
      await fetchReceivedPayments();
    } catch (error) {
      console.error("Update received payment error:", error);
      alert("Failed to update received payment");
    } finally {
      setSavingReceivedId(null);
    }
  };

  const openReceivedModal = () => {
    setReceivedForm({
      payment_date: new Date().toISOString().split("T")[0],
      reference_number: "",
      amount: "",
      attachment: null,
    });
    setShowReceivedModal(true);
  };

  const handleReceivedChange = (e) => {
    const { name, value, files } = e.target;
    if (files) {
      setReceivedForm((prev) => ({ ...prev, attachment: files[0] || null }));
    } else {
      setReceivedForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleReceivedSubmit = async (e) => {
    e.preventDefault();
    setSubmittingReceived(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("payment_date", receivedForm.payment_date);
      formDataToSend.append("reference_number", receivedForm.reference_number);
      formDataToSend.append("amount", receivedForm.amount);
      if (receivedForm.attachment) {
        formDataToSend.append("attachment", receivedForm.attachment);
      }

      const res = await fetch(`/api/manual-payment-pending/${id}/received`, {
        method: "POST",
        body: formDataToSend,
      });
      const data = await res.json();

      if (data.success) {
        alert("Received payment recorded successfully!");
        setShowReceivedModal(false);
        if (data.status) {
          setFormData((prev) => ({ ...prev, status: data.status }));
        }
        await fetchReceivedPayments();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Received payment error:", error);
      alert("Failed to record received payment");
    } finally {
      setSubmittingReceived(false);
    }
  };

  const pendingBalance = Math.max(Number(formData.amount || 0) - totalReceived, 0);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-center text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            Edit Payment Entry
          </h1>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openReceivedModal}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Received Payment
            </button>
            <button
              type="button"
              onClick={() => router.push("/accounts-dashboard/manual-payments")}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              ← Back
            </button>
          </div>
        </div>

        {auditInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Audit Trail</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800">
              <div>
                <span className="font-medium">Created by:</span> {auditInfo.created_by}
              </div>
              <div>
                <span className="font-medium">Created at:</span>{" "}
                {new Date(auditInfo.created_at).toLocaleString()}
              </div>
              {auditInfo.modified_by && (
                <>
                  <div>
                    <span className="font-medium">Modified by:</span> {auditInfo.modified_by}
                  </div>
                  <div>
                    <span className="font-medium">Modified at:</span>{" "}
                    {new Date(auditInfo.modified_at).toLocaleString()}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-600">Total Amount</p>
            <p className="text-xl font-bold text-gray-900">
              ₹{Number(formData.amount || 0).toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-700">Received</p>
            <p className="text-xl font-bold text-green-900">
              ₹{totalReceived.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
            <p className="text-sm text-orange-700">Balance</p>
            <p className="text-xl font-bold text-orange-900">
              ₹{pendingBalance.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              Customer Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="customer_name"
                  value={formData.customer_name}
                  onChange={handleChange}
                  required
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Phone
                </label>
                <input
                  type="text"
                  name="customer_phone"
                  value={formData.customer_phone}
                  onChange={handleChange}
                  className={INPUT}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Email
                </label>
                <input
                  type="email"
                  name="customer_email"
                  value={formData.customer_email}
                  onChange={handleChange}
                  className={INPUT}
                />
              </div>
            </div>
          </div>

          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              Payment Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  required
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Type
                </label>
                <select
                  name="payment_type"
                  value={formData.payment_type}
                  onChange={handleChange}
                  className={INPUT}
                >
                  <option value="advance">Advance</option>
                  <option value="full">Full</option>
                  <option value="partial">Partial</option>
                  <option value="balance">Balance</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  name="payment_method"
                  value={formData.payment_method}
                  onChange={handleChange}
                  className={INPUT}
                >
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="neft">NEFT</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference Number
                </label>
                <input
                  type="text"
                  name="reference_number"
                  value={formData.reference_number}
                  onChange={handleChange}
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  name="payment_date"
                  value={formData.payment_date}
                  onChange={handleChange}
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  name="due_date"
                  value={formData.due_date}
                  onChange={handleChange}
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className={INPUT}
                >
                  <option value="pending">Pending</option>
                  <option value="received">Received</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice File
                </label>
                {currentInvoice && !removeInvoice && (
                  <div className="mb-2 flex items-center justify-between rounded border border-gray-200 bg-gray-50 p-2">
                    <a
                      href={manualPaymentInvoiceHref(currentInvoice)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 underline"
                    >
                      View Current Invoice
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setRemoveInvoice(true);
                        setNewInvoiceFile(null);
                      }}
                      className="text-sm font-medium text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    setNewInvoiceFile(e.target.files?.[0] || null);
                    setRemoveInvoice(false);
                  }}
                  className={INPUT}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Upload a new file to replace the current invoice.
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks
                </label>
                <textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleChange}
                  rows={3}
                  className={INPUT}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/accounts-dashboard/manual-payments")}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {submitting ? "Updating..." : "Update Payment Entry"}
            </button>
          </div>
        </form>

        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            Received Payments
          </h2>
          {receivedPayments.length === 0 ? (
            <p className="text-sm italic text-gray-500">
              No received payments recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Ref Number</th>
                    <th className="px-3 py-2 text-left">Amount</th>
                    <th className="px-3 py-2 text-left">Attachment</th>
                    <th className="px-3 py-2 text-left">Recorded By</th>
                    <th className="px-3 py-2 text-left">Save</th>
                  </tr>
                </thead>
                <tbody>
                  {receivedPayments.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={row.payment_date || ""}
                          onChange={(e) =>
                            updateReceivedRow(row.id, { payment_date: e.target.value })
                          }
                          className={INPUT}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.reference_number || ""}
                          onChange={(e) =>
                            updateReceivedRow(row.id, { reference_number: e.target.value })
                          }
                          className={INPUT}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.amount ?? ""}
                          onChange={(e) =>
                            updateReceivedRow(row.id, { amount: e.target.value })
                          }
                          className={INPUT}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {row.attachment_file && (
                          <a
                            href={row.attachment_file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mb-1 block text-blue-600 underline"
                          >
                            View
                          </a>
                        )}
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) =>
                            updateReceivedRow(row.id, {
                              newAttachment: e.target.files?.[0] || null,
                            })
                          }
                          className="w-full text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">{row.received_by || "-"}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          disabled={savingReceivedId === row.id}
                          onClick={() => saveReceivedRow(row)}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingReceivedId === row.id ? "Saving..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showReceivedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-lg font-bold text-gray-900">Received Payment</h3>
              <button
                type="button"
                onClick={() => setShowReceivedModal(false)}
                className="text-xl leading-none text-gray-500 hover:text-gray-800"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleReceivedSubmit} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Payment Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  name="payment_date"
                  value={receivedForm.payment_date}
                  onChange={handleReceivedChange}
                  required
                  className={INPUT}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Ref Number
                </label>
                <input
                  type="text"
                  name="reference_number"
                  value={receivedForm.reference_number}
                  onChange={handleReceivedChange}
                  className={INPUT}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Amount <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  name="amount"
                  value={receivedForm.amount}
                  onChange={handleReceivedChange}
                  step="0.01"
                  min="0"
                  required
                  className={INPUT}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Attachment
                </label>
                <input
                  type="file"
                  name="attachment"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleReceivedChange}
                  className={INPUT}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReceivedModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReceived}
                  className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {submittingReceived ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
