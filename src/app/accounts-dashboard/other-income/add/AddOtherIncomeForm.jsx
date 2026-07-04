"use client";

import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useState } from "react";

export default function AddOtherIncomeForm() {
  const router = useRouter();
  const [isSubmitting, setSubmitting] = useState(false);
  const [gstRate, setGstRate] = useState(0);
  const [amount, setAmount] = useState(0);
  const { register, handleSubmit, reset, watch } = useForm();

  const gstApplicable = watch("gst_applicable");

  // Calculate GST amount
  const gstAmount = gstApplicable === "Yes" ? (amount * gstRate) / 100 : 0;

  const onSubmit = async (data) => {
    setSubmitting(true);

    const formData = new FormData();

    // Add all form fields
    Object.keys(data).forEach((key) => {
      if (key.includes("attachment") || key.includes("document")) {
        // Handle file uploads
        const fileInput = data[key];
        if (fileInput && fileInput.length > 0) {
          formData.append(key, fileInput[0]);
        }
      } else {
        formData.append(key, data[key] || "");
      }
    });

    // Add calculated GST amount
    formData.set("gst_amount", gstAmount);

    try {
      const res = await fetch("/api/other-income", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (res.ok) {
        toast.success("Other income entry added successfully!");
        router.push("/accounts-dashboard/other-income");
      } else {
        toast.error(result.error || "Failed to add other income");
      }
    } catch (err) {
      toast.error("Network error");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    reset();
    setAmount(0);
    setGstRate(0);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-7xl mx-auto p-6 space-y-6 bg-white rounded-xl shadow"
    >
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Add Other Income</h2>

      {/* Basic Information Section */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Basic Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">Income Name *</label>
            <input
              type="text"
              {...register("income_name", { required: true })}
              placeholder="e.g., Interest Income, Rental Income"
              className="w-full border p-2 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Income Source *</label>
            <input
              type="text"
              {...register("income_source", { required: true })}
              placeholder="e.g., Bank, Property, Investment"
              className="w-full border p-2 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Income Category</label>
            <select
              {...register("income_category")}
              className="w-full border p-2 rounded-md"
            >
              <option value="">Select Category</option>
              <option value="Interest Income">Interest Income</option>
              <option value="Rental Income">Rental Income</option>
              <option value="Scrap Sale">Scrap Sale</option>
              <option value="Commission Received">Commission Received</option>
              <option value="Discount Received">Discount Received</option>
              <option value="Miscellaneous Income">Miscellaneous Income</option>
              <option value="Asset Sale Profit">Asset Sale Profit</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Income Date *</label>
            <input
              type="date"
              {...register("income_date", { required: true })}
              className="w-full border p-2 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Transaction Date</label>
            <input
              type="date"
              {...register("transaction_date")}
              className="w-full border p-2 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Amount *</label>
            <input
              type="number"
              step="0.01"
              {...register("amount", { required: true })}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full border p-2 rounded-md"
            />
          </div>
        </div>
      </div>

      {/* GST & Tax Section */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">GST & Tax Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">GST Applicable</label>
            <select
              {...register("gst_applicable")}
              className="w-full border p-2 rounded-md"
            >
              <option value="">Select</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>

          {gstApplicable === "Yes" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">GST Rate (%)</label>
                <select
                  {...register("gst_rate")}
                  onChange={(e) => setGstRate(parseFloat(e.target.value) || 0)}
                  className="w-full border p-2 rounded-md"
                >
                  <option value="">Select Rate</option>
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">GST Amount (Auto)</label>
                <input
                  type="number"
                  step="0.01"
                  value={gstAmount.toFixed(2)}
                  disabled
                  className="w-full border p-2 rounded-md bg-gray-100"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">TDS Deducted</label>
            <select
              {...register("tds_deducted")}
              className="w-full border p-2 rounded-md"
            >
              <option value="">Select</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">TDS Amount</label>
            <input
              type="number"
              step="0.01"
              {...register("tds_amount")}
              className="w-full border p-2 rounded-md"
            />
          </div>
        </div>
      </div>

      {/* Receipt & Payment Section */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Receipt & Payment Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">Received From</label>
            <input
              type="text"
              {...register("received_from")}
              placeholder="Customer/Company/Person name"
              className="w-full border p-2 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Receipt Mode</label>
            <select
              {...register("receipt_mode")}
              className="w-full border p-2 rounded-md"
            >
              <option value="">Select Mode</option>
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="NEFT">NEFT</option>
              <option value="RTGS">RTGS</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Bank/Cash Account</label>
            <input
              type="text"
              {...register("bank_cash_account")}
              placeholder="Bank or Cash ledger"
              className="w-full border p-2 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Reference Number</label>
            <input
              type="text"
              {...register("reference_number")}
              placeholder="Cheque No., UTR, Transaction ID"
              className="w-full border p-2 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Invoice/Bill Number</label>
            <input
              type="text"
              {...register("invoice_bill_number")}
              placeholder="Related document number"
              className="w-full border p-2 rounded-md"
            />
          </div>
        </div>
      </div>

      {/* Document Upload Section */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Attachments</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">Receipt (Image/PDF)</label>
            <input
              type="file"
              {...register("receipt_attachment")}
              accept="image/*,.pdf"
              className="w-full border p-2 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Proof of Income (Image/PDF)</label>
            <input
              type="file"
              {...register("proof_attachment")}
              accept="image/*,.pdf"
              className="w-full border p-2 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Invoice/Bill</label>
            <input
              type="file"
              {...register("invoice_attachment")}
              accept="image/*,.pdf"
              className="w-full border p-2 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Supporting Document</label>
            <input
              type="file"
              {...register("supporting_document")}
              accept="image/*,.pdf"
              className="w-full border p-2 rounded-md"
            />
          </div>
        </div>
      </div>

      {/* Description Section */}
      <div className="border-t pt-6">
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            {...register("description")}
            className="w-full border p-3 rounded-md"
            rows={4}
            placeholder="Details of the income"
          ></textarea>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Remarks</label>
          <textarea
            {...register("remarks")}
            className="w-full border p-3 rounded-md"
            rows={3}
            placeholder="Additional notes"
          ></textarea>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 border-t pt-6">
        <button
          type="button"
          onClick={handleReset}
          className="w-full sm:w-auto px-6 py-3 bg-gray-500 text-gray-100 rounded-lg hover:bg-gray-600 cursor-pointer"
        >
          Reset
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? "Submitting..." : "Add Other Income"}
        </button>
      </div>
    </form>
  );
}
