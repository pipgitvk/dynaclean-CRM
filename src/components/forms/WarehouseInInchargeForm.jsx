"use client";

import { formatCrmDateOnly } from "@/lib/crmDateFormat";
import { buildWarehouseInDisplayGroups } from "@/lib/warehouseInGrouping";
import { fetchPendingWarehouseInRequests } from "@/lib/warehouseInPendingLoad";
import WarehouseInReceiveModal from "@/components/forms/WarehouseInReceiveModal";
import { Eye } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function WarehouseInInchargeForm() {
  const pathname = usePathname();
  const listPath =
    pathname?.replace(/\/$/, "") || "/user-dashboard/purchase/warehouse-in";
  const receivePath = `${listPath}/receive`;

  const [pendingRequests, setPendingRequests] = useState([]);
  const [receiveGroupKey, setReceiveGroupKey] = useState(null);
  const [viewGroupKey, setViewGroupKey] = useState(null);

  const displayGroups = useMemo(
    () => buildWarehouseInDisplayGroups(pendingRequests),
    [pendingRequests],
  );

  const receiveGroup = useMemo(() => {
    if (!receiveGroupKey) return null;
    return displayGroups.find((g) => g.groupKey === receiveGroupKey) ?? null;
  }, [displayGroups, receiveGroupKey]);

  const viewGroup = useMemo(() => {
    if (!viewGroupKey) return null;
    return displayGroups.find((g) => g.groupKey === viewGroupKey) ?? null;
  }, [displayGroups, viewGroupKey]);

  useEffect(() => {
    loadPendingRequests();
  }, []);

  useEffect(() => {
    if (receiveGroupKey && !receiveGroup) {
      setReceiveGroupKey(null);
    }
  }, [receiveGroup, receiveGroupKey]);

  useEffect(() => {
    if (viewGroupKey && !viewGroup) {
      setViewGroupKey(null);
    }
  }, [viewGroup, viewGroupKey]);

  const loadPendingRequests = async () => {
    try {
      const combined = await fetchPendingWarehouseInRequests();
      setPendingRequests(combined);
    } catch (error) {
      console.error("Error loading requests:", error);
    }
  };

  const openReceivePopup = (group) => {
    setViewGroupKey(null);
    setReceiveGroupKey(group.groupKey);
  };

  const closeReceivePopup = () => {
    setReceiveGroupKey(null);
  };

  const openViewPopup = (group) => {
    setReceiveGroupKey(null);
    setViewGroupKey(group.groupKey);
  };

  const closeViewPopup = () => {
    setViewGroupKey(null);
  };

  const handleReceived = async () => {
    await loadPendingRequests();
  };

  return (
    <>
      <div className="space-y-4 bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-6">
        <h3 className="text-lg font-semibold mb-4">
          Warehouse In - Receive Stock
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Invoice-wise list. Receive par popup — item select karke fields expand,
          yahin Receive stock. Full form page optional link se.
        </p>

        <div className="space-y-4">
          <div className="block md:hidden space-y-3">
            {displayGroups.length === 0 ? (
              <p className="text-sm text-gray-500">No pending requests</p>
            ) : (
              displayGroups.map((group) => (
                <div
                  key={group.groupKey}
                  className="border rounded-xl p-4 shadow-sm bg-white"
                >
                  <p className="font-semibold text-gray-900">
                    {group.kind === "invoice"
                      ? `Invoice ${group.invoice_number}`
                      : group.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {group.itemCount} item{group.itemCount !== 1 ? "s" : ""} ·
                    Pending {group.totalQty}
                  </p>
                  <p className="text-xs text-gray-500">
                    From: {group.from_company || "—"}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => openViewPopup(group)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-blue-200 text-blue-700"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => openReceivePopup(group)}
                      className="px-3 py-1.5 text-xs rounded bg-green-600 text-white"
                    >
                      Receive
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block border rounded-lg overflow-hidden">
            {displayGroups.length === 0 ? (
              <p className="text-sm text-gray-500 p-4">No pending requests</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-left text-xs">
                  <tr>
                    <th className="p-3 border-b">Invoice / Reference</th>
                    <th className="p-3 border-b">Invoice date</th>
                    <th className="p-3 border-b">Items</th>
                    <th className="p-3 border-b">Pending qty</th>
                    <th className="p-3 border-b">From company</th>
                    <th className="p-3 border-b">Requested</th>
                    <th className="p-3 border-b w-40">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayGroups.map((group) => (
                    <tr
                      key={group.groupKey}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="p-3 font-medium">
                        {group.kind === "invoice" ? (
                          <>Invoice {group.invoice_number}</>
                        ) : (
                          group.label
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {group.invoice_date
                          ? formatCrmDateOnly(group.invoice_date)
                          : "—"}
                      </td>
                      <td className="p-3">{group.itemCount}</td>
                      <td className="p-3">{group.totalQty}</td>
                      <td className="p-3">{group.from_company || "—"}</td>
                      <td className="p-3 whitespace-nowrap">
                        {group.created_at
                          ? formatCrmDateOnly(group.created_at)
                          : "—"}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openViewPopup(group)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => openReceivePopup(group)}
                            className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700"
                          >
                            Receive
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {viewGroup ? (
        <WarehouseInReceiveModal
          mode="view"
          group={viewGroup}
          onClose={closeViewPopup}
        />
      ) : null}
      {receiveGroup ? (
        <WarehouseInReceiveModal
          mode="receive"
          group={receiveGroup}
          receivePageHref={receivePath}
          onClose={closeReceivePopup}
          onReceived={handleReceived}
        />
      ) : null}
    </>
  );
}
