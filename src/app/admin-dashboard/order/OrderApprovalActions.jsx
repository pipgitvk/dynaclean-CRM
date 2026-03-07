"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";

const REVERT_WINDOW_HOURS = 4;

function canRevert(approvalDate) {
  if (!approvalDate) return false;
  const approvedAt = new Date(approvalDate).getTime();
  const now = Date.now();
  const hoursPassed = (now - approvedAt) / (1000 * 60 * 60);
  return hoursPassed < REVERT_WINDOW_HOURS;
}

export default function OrderApprovalActions({
  orderId,
  approvalStatus,
  userRole,
  approvalDate,
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [modalAction, setModalAction] = useState(null); // 'approve' | 'reject'
  const [remark, setRemark] = useState("");
  const isSuperAdmin =
    (userRole || "").toString().trim().toUpperCase() === "SUPERADMIN";
  const revertAllowed = canRevert(approvalDate);

  const submitAction = async (action, remarkVal) => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: Number(orderId),
          action,
          remark: remarkVal || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        setModalAction(null);
        setRemark("");
        router.refresh();
      } else {
        alert(json.error);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to process approval");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action) => {
    if (action === "pending") {
      if (!revertAllowed) {
        toast.error("Revert is only allowed within 4 hours of approval/rejection.");
        return;
      }
      if (!confirm("Reset this order to Pending approval?")) return;
      await submitAction("pending");
      return;
    }
    setModalAction(action);
  };

  const handleModalSubmit = () => {
    submitAction(modalAction, remark);
  };

  if (approvalStatus === "approved") {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1 text-green-600 font-semibold px-3 py-2 bg-green-50 rounded-lg border border-green-100">
          <CheckCircle size={16} />
          <span>Approved</span>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => handleAction("pending")}
            disabled={loading}
            className={`text-sm mt-1 ${revertAllowed ? "text-gray-500 hover:text-orange-600 underline" : "text-gray-400 cursor-not-allowed"}`}
            title={revertAllowed ? "Reset to Pending (within 4 hours)" : "Revert disabled after 4 hours"}
          >
            Revert
          </button>
        )}
      </div>
    );
  }
  if (approvalStatus === "rejected") {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1 text-red-600 font-semibold px-3 py-2 bg-red-50 rounded-lg border border-red-100">
          <XCircle size={16} />
          <span>Rejected</span>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => handleAction("pending")}
            disabled={loading}
            className={`text-sm mt-1 ${revertAllowed ? "text-gray-500 hover:text-orange-600 underline" : "text-gray-400 cursor-not-allowed"}`}
            title={revertAllowed ? "Reset to Pending (within 4 hours)" : "Revert disabled after 4 hours"}
          >
            Revert
          </button>
        )}
      </div>
    );
  }

  if (isSuperAdmin) {
    return (
      <>
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            onClick={() => handleAction("approve")}
            disabled={loading}
            className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-medium border border-green-200"
          >
            Approve
          </button>
          <button
            onClick={() => handleAction("reject")}
            disabled={loading}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium border border-red-200"
          >
            Reject
          </button>
        </div>
        {modalAction && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
            onClick={(e) => e.target === e.currentTarget && setModalAction(null)}
          >
            <div
              className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-semibold mb-3 text-gray-800">
                {modalAction === "approve" ? "Approve Order" : "Reject Order"}
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                Order: <strong>{orderId}</strong>
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remark (optional)
              </label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Add remark..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setModalAction(null);
                    setRemark("");
                  }}
                  className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleModalSubmit}
                  disabled={loading}
                  className={`px-3 py-1.5 rounded text-sm font-medium text-white disabled:opacity-50 ${
                    modalAction === "approve"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {loading
                    ? "Processing..."
                    : modalAction === "approve"
                    ? "Approve"
                    : "Reject"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <span className="text-orange-600 font-medium italic text-sm">
      Waiting for Admin
    </span>
  );
}
