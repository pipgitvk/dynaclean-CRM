"use client";
import { useState, useEffect, useCallback } from "react";

export default function UpcomingInstallationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(50);

  // Partial return modal state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [returnableItems, setReturnableItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [returnReasons, setReturnReasons] = useState({});
  const [modalLoading, setModalLoading] = useState(false);

  // ========= ACTIONS ==========
  const handleAction = async (orderId, action) => {
    if (!orderId || !action) return;
    try {
      setLoading(true);
      const res = await fetch("/api/installation/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, action }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        alert(data.error || "Action failed");
      } else {
        alert(data.message || "Action completed successfully");
      }
      await fetchData(currentPage, searchQuery);
    } catch (err) {
      console.error(err);
      alert("Failed to perform action");
    } finally {
      setLoading(false);
    }
  };

  const openReturnModal = async (orderId) => {
    setSelectedOrder(orderId);
    setShowReturnModal(true);
    setModalLoading(true);
    setSelectedItems([]);
    setReturnReasons({});

    try {
      const res = await fetch(
        `/api/installation/returnable-items?order_id=${orderId}`
      );
      const data = await res.json();

      if (data.success) {
        setReturnableItems(data.items || []);
      } else {
        alert(data.error || "Failed to fetch returnable items");
        setShowReturnModal(false);
      }
    } catch (err) {
      alert("Failed to fetch returnable items");
      setShowReturnModal(false);
    } finally {
      setModalLoading(false);
    }
  };

  const handleItemSelection = (id, checked) => {
    setSelectedItems((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    );
  };

  const handleReasonChange = (id, reason) => {
    setReturnReasons({ ...returnReasons, [id]: reason });
  };

  const submitPartialReturn = async () => {
    if (selectedItems.length === 0) {
      alert("Select at least one item");
      return;
    }

    const itemsToReturn = selectedItems.map((dispatchId) => ({
      dispatch_id: dispatchId,
      reason: returnReasons[dispatchId] || "",
    }));

    try {
      setModalLoading(true);
      const res = await fetch("/api/installation/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: selectedOrder,
          action: "PARTIAL_RETURN",
          items_to_return: itemsToReturn,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message || "Items returned successfully");
        setShowReturnModal(false);
        await fetchData(currentPage, searchQuery);
      } else {
        alert(data.error || "Failed to return items");
      }
    } catch (err) {
      alert("Failed to return items");
    } finally {
      setModalLoading(false);
    }
  };

  // ========= FETCH DATA ==========
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/installation/upcoming`);
      const data = await res.json();

      setRecords(data.installations || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
      setCurrentPage(data.currentPage || 1);
    } catch (err) {
      console.error("Fetch error", err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // ========= UI HELPERS ==========
  const getRowClass = (status) => {
    if (status === "overdue") return "bg-red-100";
    if (status === "upcoming") return "bg-yellow-100";
    return "bg-white";
  };

  const dateColor = (status) => {
    return status === "overdue"
      ? "text-red-600 font-bold"
      : status === "upcoming"
      ? "text-orange-600 font-bold"
      : "text-gray-800";
  };

  const formatDays = (days) =>
    days < 0
      ? `${Math.abs(days)} days overdue`
      : days === 0
      ? "Today"
      : `In ${days} days`;

  // ================= UI START ===================
  return (
    <div className="w-full max-w-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-bold">Upcoming Installations</h2>
        <p className="text-sm text-gray-600">Total: {total} records</p>
      </div>

      {/* Search + Legend */}
      <div className="flex flex-col gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by model, company, employee..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2 border rounded shadow-sm"
        />

        <div className="flex gap-6">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-100 mr-2" />
            Overdue
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-yellow-100 mr-2" />
            Within 10 Days
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-white border mr-2" />
            Scheduled
          </div>
        </div>
      </div>

      {/** ================= MOBILE VIEW (CARDS) ================= */}
      <div className="md:hidden space-y-4">
        {records.map((r, i) => (
          <div
            key={i}
            className={`rounded-xl shadow p-4 border ${getRowClass(
              r.installation_status
            )}`}
          >
            <div className="text-lg font-bold mb-2">Order #{r.order_id}</div>

            <div className="space-y-1 text-sm">
              <p>
                <b>Model:</b> {r.model}
              </p>
              <p>
                <b>Name:</b> {r.name}
              </p>
              <p>
                <b>Company:</b> {r.company_name}
              </p>
              <p>
                <b>Contact:</b> {r.contact}
              </p>
              <p>
                <b>Emp:</b> {r.emp_name}
              </p>
              <p>
                <b>Address:</b> {r.delivery_address}
              </p>
              <p className={`${dateColor(r.installation_status)} mt-1`}>
                <b>Delivery:</b> {r.delivery_date}
              </p>
              <p className={`${dateColor(r.installation_status)}`}>
                <b>Days:</b> {formatDays(r.days_until_installation)}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleAction(r.order_id, "INSTALLED")}
                className="flex-1 px-3 py-2 bg-green-600 text-white text-xs rounded"
              >
                Installed
              </button>

              <button
                onClick={() => openReturnModal(r.order_id)}
                className="flex-1 px-3 py-2 bg-orange-600 text-white text-xs rounded"
              >
                Partial Return
              </button>

              <button
                onClick={() => handleAction(r.order_id, "RETURNED")}
                className="flex-1 px-3 py-2 bg-red-600 text-white text-xs rounded"
              >
                Full Return
              </button>
            </div>
          </div>
        ))}
      </div>

      {/** ================= DESKTOP TABLE VIEW ================= */}
      <div className="hidden md:block overflow-x-auto shadow bg-white rounded">
        <table className="w-full text-sm table-auto border-collapse">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th className="p-3">Order ID</th>
              <th className="p-3">Model</th>
              <th className="p-3">Name</th>
              <th className="p-3">Delivery Address</th>
              <th className="p-3">Company</th>
              <th className="p-3">Contact</th>
              <th className="p-3">Emp</th>
              <th className="p-3">Delivery</th>
              <th className="p-3">Days</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={i} className={getRowClass(r.installation_status)}>
                <td className="p-3">{r.order_id}</td>
                <td className="p-3">{r.model}</td>
                <td className="p-3">{r.name}</td>
                <td className="p-3">{r.delivery_address}</td>
                <td className="p-3">{r.company_name}</td>
                <td className="p-3">{r.contact}</td>
                <td className="p-3">{r.emp_name}</td>
                <td className={`p-3 ${dateColor(r.installation_status)}`}>
                  {r.delivery_date}
                </td>
                <td className={`p-3 ${dateColor(r.installation_status)}`}>
                  {formatDays(r.days_until_installation)}
                </td>
                <td className="p-3 space-x-2">
                  <button
                    onClick={() => handleAction(r.order_id, "INSTALLED")}
                    className="px-3 py-1 bg-green-600 text-white rounded text-xs"
                  >
                    Installed
                  </button>
                  <button
                    onClick={() => openReturnModal(r.order_id)}
                    className="px-3 py-1 bg-orange-600 text-white rounded text-xs"
                  >
                    Partial Return
                  </button>
                  <button
                    onClick={() => handleAction(r.order_id, "RETURNED")}
                    className="px-3 py-1 bg-red-600 text-white rounded text-xs"
                  >
                    Full Return
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ================= MODAL ================= */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-5 border-b">
              <h3 className="text-xl font-bold">
                Partial Return - #{selectedOrder}
              </h3>
              <p className="text-sm text-gray-600">Select items to return</p>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto flex-1">
              {modalLoading ? (
                <div className="text-center py-6">Loading items...</div>
              ) : (
                <div className="space-y-4">
                  {returnableItems.map((item) => (
                    <div
                      key={item.dispatch_id}
                      className="border rounded-lg p-4 bg-white shadow-sm"
                    >
                      <div className="flex gap-3">
                        <input
                          type="checkbox"
                          disabled={!item.can_return}
                          checked={selectedItems.includes(item.dispatch_id)}
                          onChange={(e) =>
                            handleItemSelection(
                              item.dispatch_id,
                              e.target.checked
                            )
                          }
                        />

                        <div className="flex-1 text-sm">
                          <p>
                            <b>Item:</b> {item.item_name}
                          </p>
                          <p>
                            <b>Item Code:</b> {item.item_code}
                          </p>
                          <p>
                            <b>Serial:</b> {item.serial_no || "N/A"}
                          </p>
                          <p>
                            <b>Warehouse:</b> {item.godown}
                          </p>

                          {!item.can_return && (
                            <p className="text-red-600 mt-2">
                              Already Returned or Not Eligible
                            </p>
                          )}

                          {selectedItems.includes(item.dispatch_id) && (
                            <input
                              type="text"
                              className="mt-3 w-full border rounded px-3 py-2"
                              placeholder="Return reason (optional)"
                              value={returnReasons[item.dispatch_id] || ""}
                              onChange={(e) =>
                                handleReasonChange(
                                  item.dispatch_id,
                                  e.target.value
                                )
                              }
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t flex justify-end gap-2 bg-gray-50">
              <button
                onClick={() => setShowReturnModal(false)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Cancel
              </button>

              <button
                onClick={submitPartialReturn}
                disabled={modalLoading || selectedItems.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {modalLoading ? "Processing..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
