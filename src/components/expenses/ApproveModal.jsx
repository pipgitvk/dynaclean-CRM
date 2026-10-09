"use client";

import { useState } from "react";

export default function ApproveModal({ expenseId, initialAmount, approver }) {
  const [showModal, setShowModal] = useState(false);
  const [approvedAmount, setApprovedAmount] = useState(initialAmount);
  const [approvalDate, setApprovalDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [status, setStatus] = useState("Approved");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/expenses/approve", {
      method: "POST",
      body: JSON.stringify({
        expense_id: expenseId,
        approved_amount: approvedAmount,
        approval_status: status,
        approval_date: approvalDate,
        approved_by: approver,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    setLoading(false);
    if (res.ok) {
      setShowModal(false);
      window.location.reload();
    } else {
      alert("Failed to approve expense");
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 cursor-pointer"
      >
        Approve
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-opacity-40 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-lg rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Approve Expense</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-medium">Approved Amount</label>
                <input
                  type="number"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block font-medium">Approval Date</label>
                <input
                  type="date"
                  value={approvalDate}
                  onChange={(e) => setApprovalDate(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block font-medium">Approval Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option>Approved</option>
                  <option>Rejected</option>
                  <option>Partial Approved</option>
                  <option>Pending</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  disabled={loading}
                >
                  {loading ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
