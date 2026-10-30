"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import { canEditDeliveryProof } from "@/lib/orderDocumentEditRules";
import { canShowOrderDeliveryActions } from "@/lib/orderDeliveryEligibility";
import {
  getDeliveryBatchForView,
  orderHasSecondDeliveryBatch,
  orderNeedsRemainDeliverySave,
} from "@/lib/orderDeliveryBatches";
import {
  isOrderFullyDelivered,
  orderHasDeliveryRecord,
} from "@/lib/orderDeliveryStatus";
import {
  canManageAnyOrderDeliveryRole,
  canViewOrderDeliveryDetailsRole,
  isSuperAdminRole,
} from "@/lib/roleKeyUtils";

export default function UpdateDeliveryMenuItem({ order, userRole, variant = "auto", layout = "menu" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [deliveredOn, setDeliveredOn] = useState("");
  const [deliveryProof, setDeliveryProof] = useState(null);
  const [deliveryRemark, setDeliveryRemark] = useState("");
  const [uploading, setUploading] = useState(false);
  const canViewDeliveryDetails = canViewOrderDeliveryDetailsRole(userRole);
  const superAdmin = isSuperAdminRole(userRole);
  const canManageAnyDelivery = canManageAnyOrderDeliveryRole(userRole);

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/me");
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.username);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

  const isFullyDelivered = isOrderFullyDelivered(order);
  const hasDeliveryRecord = orderHasDeliveryRecord(order);
  const canUpdateDeliveryProof = canEditDeliveryProof(order);

  // Check if menu item should be shown
  const shouldShow = () => {
    if (!canShowOrderDeliveryActions(order)) return false;

    if (superAdmin || canManageAnyDelivery) return true;

    if (canViewDeliveryDetails) {
      return hasDeliveryRecord;
    }

    if (!currentUser || order.booking_by !== currentUser) return false;
    return true;
  };

  const viewOnly =
    !superAdmin &&
    !canManageAnyDelivery &&
    canViewDeliveryDetails &&
    hasDeliveryRecord;

  const uploadDeliveryProofFile = async () => {
    if (!deliveryProof) return null;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", deliveryProof);
    const uploadRes = await fetch("/api/upload-delivery-proof", {
      method: "POST",
      body: formData,
    });
    setUploading(false);
    if (!uploadRes.ok) {
      throw new Error("Failed to upload delivery proof");
    }
    const uploadJson = await uploadRes.json();
    return uploadJson.url;
  };

  const handleSave = async () => {
    if (!deliveredOn) {
      alert("Please select delivery date");
      return;
    }

    try {
      setSaving(true);
      const deliveryProofUrl = await uploadDeliveryProofFile();

      const res = await fetch("/api/orders/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.order_id,
          delivered_on: deliveredOn,
          delivery_proof: deliveryProofUrl,
          delivery_remark: deliveryRemark,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update delivery status");
      }

      alert("Delivery status updated successfully!");
      setOpen(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to update delivery status");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleUpdateProof = async () => {
    if (!deliveryProof) {
      alert("Please select a delivery proof file");
      return;
    }

    try {
      setSaving(true);
      const deliveryProofUrl = await uploadDeliveryProofFile();

      const res = await fetch("/api/orders/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.order_id,
          delivery_proof: deliveryProofUrl,
          update_proof_only: true,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update delivery proof");
      }

      alert("Delivery proof updated successfully!");
      setOpen(false);
      setDeliveryProof(null);
      router.refresh();
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to update delivery proof");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  if (variant === "view_first") {
    if (!canShowOrderDeliveryActions(order) || !hasDeliveryRecord) return null;
  } else if (variant === "view_remain") {
    if (
      !canShowOrderDeliveryActions(order) ||
      !orderHasSecondDeliveryBatch(order)
    ) {
      return null;
    }
  } else if (variant === "update_remain") {
    if (
      !canShowOrderDeliveryActions(order) ||
      !hasDeliveryRecord ||
      (isFullyDelivered && !orderNeedsRemainDeliverySave(order))
    ) {
      return null;
    }
  } else if (variant === "view") {
    if (!canShowOrderDeliveryActions(order) || !hasDeliveryRecord) return null;
  } else if (variant === "update") {
    if (!canShowOrderDeliveryActions(order) || isFullyDelivered) return null;
  } else if (!shouldShow()) {
    return null;
  }

  const batchForModal =
    variant === "view_first"
      ? getDeliveryBatchForView(order, "first")
      : variant === "view_remain"
        ? getDeliveryBatchForView(order, "remain")
        : null;
  const displayOrder = batchForModal
    ? {
        ...order,
        delivered_on: batchForModal.delivered_on,
        delivery_proof: batchForModal.delivery_proof,
        delivery_remark: batchForModal.delivery_remark,
      }
    : order;

  const readOnlyDeliveryModal =
    variant === "view_first" ||
    variant === "view_remain" ||
    variant === "view" ||
    (variant === "auto" && (viewOnly || isFullyDelivered));

  const menuLabel =
    variant === "view_first"
      ? "View Delivery"
      : variant === "view_remain"
        ? "View Delivery (Remain)"
        : variant === "update_remain"
          ? "Update Delivery (Remain)"
          : variant === "update"
            ? "Update Delivery"
            : readOnlyDeliveryModal
              ? "View Delivery"
              : "Update Delivery";

  const formatDate = (d) => {
    if (!d) return "-";
    const date = new Date(d);
    return isNaN(date) ? d : date.toLocaleDateString("en-IN");
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-blue-700 text-left"
        title={readOnlyDeliveryModal ? "View Delivery" : "Update Delivery Status"}
      >
        <Truck size={16} />
        <span>{menuLabel}</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">
              {readOnlyDeliveryModal
                ? variant === "view_remain"
                  ? "Delivery Details (Remain)"
                  : "Delivery Details"
                : variant === "update_remain"
                  ? "Update Delivery (Remain)"
                  : "Update Delivery Status"}
            </h3>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">
                  Order ID:{" "}
                  <span className="font-medium text-gray-800">
                    {order.order_id}
                  </span>
                </p>
                <p className="text-sm text-gray-600">
                  Client:{" "}
                  <span className="font-medium text-gray-800">
                    {order.client_name}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Expected Delivery Date:
                </label>
                <p className="text-sm font-medium text-gray-800">
                  {formatDate(order.delivery_date)}
                </p>
              </div>

              {readOnlyDeliveryModal ? (
                <>
                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Actual Delivery Date:
                    </label>
                    <p className="text-sm font-medium text-gray-800">
                      {formatDate(displayOrder.delivered_on)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Delivery Proof:
                    </label>
                    {displayOrder.delivery_proof ? (
                      <div className="flex gap-3">
                        <a
                          href={displayOrder.delivery_proof}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium transition"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                          View
                        </a>
                        <a
                          href={displayOrder.delivery_proof}
                          download
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-sm font-medium transition"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                          Download
                        </a>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        No delivery proof uploaded
                      </p>
                    )}
                    {canUpdateDeliveryProof && !viewOnly && (
                      <div className="mt-3">
                        <label className="block text-sm text-gray-700 font-medium mb-1">
                          {displayOrder.delivery_proof
                            ? "Replace Delivery Proof"
                            : "Upload Delivery Proof"}
                        </label>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) =>
                            setDeliveryProof(e.target.files?.[0] || null)
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                        {deliveryProof && (
                          <p className="text-xs text-gray-600 mt-1">
                            Selected: {deliveryProof.name}
                          </p>
                        )}
                        <p className="text-xs text-amber-700 mt-1">
                          Editable within 24 hours of delivery
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Delivery Remark:
                    </label>
                    {displayOrder.delivery_remark ? (
                      <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded">
                        {displayOrder.delivery_remark}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        No remark provided
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Actual Delivery Date *
                    </label>
                    <TypeableDateFilterInput value={deliveredOn} onChange={setDeliveredOn} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required/>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Delivery Proof (Optional)
                    </label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setDeliveryProof(e.target.files[0])}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {deliveryProof && (
                      <p className="text-xs text-gray-600 mt-1">
                        Selected: {deliveryProof.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Delivery Remark (Optional)
                    </label>
                    <textarea
                      value={deliveryRemark}
                      onChange={(e) => setDeliveryRemark(e.target.value)}
                      placeholder="Enter any remarks about the delivery..."
                      maxLength="500"
                      rows="3"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {deliveryRemark.length}/500 characters
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                {readOnlyDeliveryModal ? "Close" : "Cancel"}
              </button>
              {!readOnlyDeliveryModal && (
                <button
                  onClick={handleSave}
                  disabled={saving || uploading}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {uploading
                    ? "Uploading..."
                    : saving
                    ? "Saving..."
                    : "Mark as Delivered"}
                </button>
              )}
              {readOnlyDeliveryModal && canUpdateDeliveryProof && !viewOnly && (
                <button
                  onClick={handleUpdateProof}
                  disabled={saving || uploading || !deliveryProof}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {uploading
                    ? "Uploading..."
                    : saving
                    ? "Saving..."
                    : "Update Proof"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}