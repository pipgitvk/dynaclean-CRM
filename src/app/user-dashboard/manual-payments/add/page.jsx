"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddPaymentPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
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
    const [invoiceFile, setInvoiceFile] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        setInvoiceFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const formDataToSend = new FormData();
            Object.keys(formData).forEach((key) => {
                formDataToSend.append(key, formData[key]);
            });

            if (invoiceFile) {
                formDataToSend.append("invoice_file", invoiceFile);
            }

            const res = await fetch("/api/manual-payment-pending", {
                method: "POST",
                body: formDataToSend,
            });

            const data = await res.json();

            if (data.success) {
                alert("Payment entry created successfully!");
                router.push("/user-dashboard/manual-payments");
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error("Submission error:", error);
            alert("Failed to create payment entry");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6">
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                        Add Manual Payment Entry
                    </h1>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="text-gray-600 hover:text-gray-800 font-medium"
                    >
                        ← Back
                    </button>
                </div>

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
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Invoice File
                                </label>
                                <input
                                    type="file"
                                    onChange={handleFileChange}
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    PDF, JPG, JPEG, or PNG (Max 10MB)
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
                            disabled={loading}
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Creating..." : "Create Payment Entry"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
