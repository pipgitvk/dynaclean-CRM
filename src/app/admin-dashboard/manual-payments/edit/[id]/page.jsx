"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function EditPaymentPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
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

    useEffect(() => {
        fetchPaymentData();
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
                    payment_date: payment.payment_date ? payment.payment_date.split('T')[0] : "",
                    due_date: payment.due_date ? payment.due_date.split('T')[0] : "",
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
                router.push("/admin-dashboard/manual-payments");
            }
        } catch (error) {
            console.error("Fetch error:", error);
            alert("Failed to load payment entry");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        setNewInvoiceFile(e.target.files[0]);
        setRemoveInvoice(false);
    };

    const handleRemoveInvoice = () => {
        setRemoveInvoice(true);
        setNewInvoiceFile(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const formDataToSend = new FormData();
            Object.keys(formData).forEach((key) => {
                formDataToSend.append(key, formData[key]);
            });

            if (newInvoiceFile) {
                formDataToSend.append("invoice_file", newInvoiceFile);
            }

            if (removeInvoice) {
                formDataToSend.append("remove_invoice", "true");
            }

            const res = await fetch(`/api/manual-payment-pending/${id}`, {
                method: "PUT",
                body: formDataToSend,
            });

            const data = await res.json();

            if (data.success) {
                alert("Payment entry updated successfully!");
                router.push("/admin-dashboard/manual-payments");
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
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                        Edit Payment Entry
                    </h1>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="text-gray-600 hover:text-gray-800 font-medium"
                    >
                        ← Back
                    </button>
                </div>

                {/* Audit Information */}
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

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Customer Information */}
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Payment Details */}
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                {currentInvoice && !removeInvoice && !newInvoiceFile && (
                                    <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded flex items-center justify-between">
                                        <a
                                            href={currentInvoice}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 text-sm underline"
                                        >
                                            View Current Invoice
                                        </a>
                                        <button
                                            type="button"
                                            onClick={handleRemoveInvoice}
                                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )}
                                {(removeInvoice || !currentInvoice) && (
                                    <input
                                        type="file"
                                        onChange={handleFileChange}
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                )}
                                {!removeInvoice && currentInvoice && (
                                    <input
                                        type="file"
                                        onChange={handleFileChange}
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                    Upload new file to replace current invoice
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
                                    rows="3"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                ></textarea>
                            </div>
                        </div>
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex gap-4 justify-end">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? "Updating..." : "Update Payment Entry"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
