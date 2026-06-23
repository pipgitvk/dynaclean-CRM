"use client";

import { useState } from "react";
import toast from "react-hot-toast";

export default function QuickQuotationModal({ isOpen, onClose, onSuccess, initialCustomerId = "" }) {
  const [customerIdInput, setCustomerIdInput] = useState(initialCustomerId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreateQuotation = async () => {
    if (!customerIdInput.trim()) {
      setError("Please enter a customer ID");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Verify customer exists
      const verifyRes = await fetch("/api/customer-by-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerIdInput.trim() }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyData.success) {
        setError("Customer not found. You can still create a quotation by entering the ID.");
        // Allow user to proceed even if customer doesn't exist
      }

      // Redirect to quotation creation page with customer ID
      window.location.href = `/user-dashboard/quotations/new?customerId=${encodeURIComponent(customerIdInput.trim())}`;
      
    } catch (err) {
      console.error("Error:", err);
      setError("An error occurred. Please try again.");
      toast.error("Failed to process request");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Create New Quotation
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Enter the customer ID to create a new quotation. If the customer doesn't exist in the system, you can still proceed with their ID.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer ID *
            </label>
            <input
              type="text"
              value={customerIdInput}
              onChange={(e) => {
                setCustomerIdInput(e.target.value);
                setError("");
              }}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateQuotation();
                }
              }}
              placeholder="Enter customer ID"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
              autoFocus
            />
            {error && (
              <p className="text-sm text-amber-600 mt-2">{error}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCreateQuotation}
              disabled={isLoading || !customerIdInput.trim()}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Loading..." : "Create Quotation"}
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                setCustomerIdInput("");
                setError("");
              }}
              disabled={isLoading}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
