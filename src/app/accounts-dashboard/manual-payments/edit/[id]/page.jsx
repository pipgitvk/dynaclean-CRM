"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";

const READONLY_INPUT =
  "w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-800 cursor-not-allowed";

function joinCommaSeparated(values) {
  const seen = new Set();
  const list = [];

  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    list.push(trimmed);
  }

  return list.length ? list.join(", ") : "-";
}

function formatDisplayDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value).trim()
    : date.toLocaleDateString("en-IN");
}

export default function EditPaymentPage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;

  const [loading, setLoading] = useState(true);
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
          payment_date: payment.payment_date
            ? payment.payment_date.split("T")[0]
            : "",
          due_date: payment.due_date ? payment.due_date.split("T")[0] : "",
          status: payment.status || "pending",
          remarks: payment.remarks || "",
        });
        setCurrentInvoice(payment.invoice_file);
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
        setReceivedPayments(data.data || []);
        setTotalReceived(Number(data.total_received || 0));
        if (data.status) {
          setFormData((prev) => ({ ...prev, status: data.status }));
        }
      }
    } catch (error) {
      console.error("Fetch received payments error:", error);
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

  const pendingBalance = Math.max(
    Number(formData.amount || 0) - totalReceived,
    0,
  );

  const invoiceAttachments = useMemo(() => {
    const items = [];

    if (currentInvoice) {
      items.push({
        id: "original-invoice",
        label: "Original Invoice",
        url: currentInvoice,
      });
    }

    receivedPayments.forEach((row) => {
      if (!row.attachment_file) return;
      const dateLabel = row.payment_date
        ? new Date(row.payment_date).toLocaleDateString("en-IN")
        : "";
      const refLabel = row.reference_number ? ` • ${row.reference_number}` : "";
      items.push({
        id: `received-${row.id}`,
        label: `Received Payment${dateLabel ? ` (${dateLabel}${refLabel})` : ""}`,
        url: row.attachment_file,
      });
    });

    return items;
  }, [currentInvoice, receivedPayments]);

  const displayReferenceNumbers = useMemo(() => {
    const refs = [];
    if (formData.reference_number) refs.push(formData.reference_number);
    receivedPayments.forEach((row) => {
      if (row.reference_number) refs.push(row.reference_number);
    });
    return joinCommaSeparated(refs);
  }, [formData.reference_number, receivedPayments]);

  const displayPaymentDates = useMemo(() => {
    const dates = [];
    if (formData.payment_date) dates.push(formatDisplayDate(formData.payment_date));
    receivedPayments.forEach((row) => {
      if (row.payment_date) dates.push(formatDisplayDate(row.payment_date));
    });
    return joinCommaSeparated(dates);
  }, [formData.payment_date, receivedPayments]);

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
            Payment Entry Details
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
                <span className="font-medium">Created by:</span>{" "}
                {auditInfo.created_by}
              </div>
              <div>
                <span className="font-medium">Created at:</span>{" "}
                {new Date(auditInfo.created_at).toLocaleString()}
              </div>
              {auditInfo.modified_by && (
                <>
                  <div>
                    <span className="font-medium">Modified by:</span>{" "}
                    {auditInfo.modified_by}
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

        <div className="space-y-6">
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              Customer Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ReadOnlyField label="Customer Name" value={formData.customer_name} />
              <ReadOnlyField label="Customer Phone" value={formData.customer_phone} />
              <div className="md:col-span-2">
                <ReadOnlyField label="Customer Email" value={formData.customer_email} />
              </div>
            </div>
          </div>

          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              Payment Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ReadOnlyField label="Amount" value={formData.amount} />
              <ReadOnlyField
                label="Payment Type"
                value={formData.payment_type}
              />
              <ReadOnlyField
                label="Payment Method"
                value={formData.payment_method}
              />
              <ReadOnlyField
                label="Reference Number"
                value={displayReferenceNumbers}
              />
              <ReadOnlyField
                label="Payment Date"
                value={displayPaymentDates}
              />
              <ReadOnlyField label="Due Date" value={formData.due_date} />
              <ReadOnlyField label="Status" value={formData.status} />
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice / Attachments
                </label>
                {invoiceAttachments.length > 0 ? (
                  <ul className="space-y-1 rounded-md border border-gray-200 bg-gray-50 p-3">
                    {invoiceAttachments.map((item, index) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="text-gray-700">
                          {index + 1}. {item.label}
                        </span>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-blue-600 hover:text-blue-800 underline"
                        >
                          View Invoice
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No invoice uploaded</p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks
                </label>
                <textarea
                  value={formData.remarks}
                  readOnly
                  rows={3}
                  className={READONLY_INPUT}
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              Received Payments
            </h2>
            {receivedPayments.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No received payments recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Ref Number</th>
                      <th className="px-4 py-2 text-left">Amount</th>
                      <th className="px-4 py-2 text-left">Attachment</th>
                      <th className="px-4 py-2 text-left">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivedPayments.map((row) => (
                      <tr key={row.id} className="border-t border-gray-100">
                        <td className="px-4 py-2">
                          {row.payment_date
                            ? new Date(row.payment_date).toLocaleDateString("en-IN")
                            : "-"}
                        </td>
                        <td className="px-4 py-2">
                          {row.reference_number || "-"}
                        </td>
                        <td className="px-4 py-2">
                          ₹{Number(row.amount || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-2">
                          {row.attachment_file ? (
                            <a
                              href={row.attachment_file}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline"
                            >
                              View
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-2">{row.received_by || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showReceivedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-lg font-bold text-gray-900">
                Received Payment
              </h3>
              <button
                type="button"
                onClick={() => setShowReceivedModal(false)}
                className="text-gray-500 hover:text-gray-800 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleReceivedSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  name="payment_date"
                  value={receivedForm.payment_date}
                  onChange={handleReceivedChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ref Number
                </label>
                <input
                  type="text"
                  name="reference_number"
                  value={receivedForm.reference_number}
                  onChange={handleReceivedChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Attachment
                </label>
                <input
                  type="file"
                  name="attachment"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleReceivedChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReceivedModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReceived}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
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

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value || "-"}
        readOnly
        className={READONLY_INPUT}
      />
    </div>
  );
}
