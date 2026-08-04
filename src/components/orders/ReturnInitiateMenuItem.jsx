"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import toast from "react-hot-toast";

export default function ReturnInitiateMenuItem({
  order,
  orderListPath = "/admin-dashboard/order",
  creditNotePath = "/admin-dashboard/credit-notes/new",
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItems, setSelectedItems] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const dispatchDone = Number(order.dispatch_status) === 1;
  if (!dispatchDone) return null;

  const fetchItems = async () => {
    setLoadingItems(true);
    try {
      const res = await fetch(
        `/api/orders/items?quote_number=${encodeURIComponent(order.quote_number)}`
      );
      const json = await res.json();
      if (json.success) {
        setItems(json.items || []);
      } else {
        toast.error(json.error || "Failed to load items");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load order items");
    } finally {
      setLoadingItems(false);
    }
  };

  const handleOpen = (e) => {
    e.stopPropagation();
    setOpen(true);
    setSelectedItems({});
    fetchItems();
  };

  const toggleItem = (itemId) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[itemId]) {
        delete next[itemId];
      } else {
        next[itemId] = true;
      }
      return next;
    });
  };

  const selectedCount = Object.keys(selectedItems).length;

  const handleCreateCreditNote = async () => {
    if (selectedCount === 0) {
      toast.error("Please select at least one product to return");
      return;
    }
    const returnItems = items.filter((it) => selectedItems[it.id]);
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders/return-initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.order_id,
          quote_number: order.quote_number,
          items: returnItems.map((it) => ({
            id: it.id,
            item_name: it.item_name,
            item_code: it.item_code,
            qty: it.quantity || 1,
            price: it.total_taxable_amt || it.taxable_price || it.total_price || 0,
          })),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Credit note created! Opening…");
        setOpen(false);
        sessionStorage.setItem("creditNoteDraft", JSON.stringify(json.draft));
        sessionStorage.setItem("creditNoteReturnPath", orderListPath);
        router.push(creditNotePath);
      } else {
        toast.error(json.error || "Failed to create credit note");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to initiate return");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-orange-50 text-orange-700 text-left"
        title="Initiate Return"
      >
        <ArrowUp size={16} />
        <span>Return Initiate</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Return Initiate
                </h3>
                <p className="text-sm text-gray-500">
                  Order:{" "}
                  <span className="font-medium text-gray-700">{order.order_id}</span>
                  {order.client_name && (
                    <>
                      {" "}
                      &nbsp;·&nbsp; {order.client_name}
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Select the products to include in the return. A credit note will be
              created for the selected items.
            </p>

            <div className="border border-gray-200 rounded-lg overflow-hidden mb-5">
              {loadingItems ? (
                <div className="py-8 text-center text-gray-500 text-sm">
                  Loading products…
                </div>
              ) : items.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-sm">
                  No products found for this order.
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="w-10 px-3 py-2"></th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">
                        Product
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">
                        Code
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">
                        Qty
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={`border-t border-gray-100 cursor-pointer transition-colors ${
                          selectedItems[item.id]
                            ? "bg-orange-50"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={!!selectedItems[item.id]}
                            onChange={() => toggleItem(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 accent-orange-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800">
                          {item.item_name || "-"}
                        </td>
                        <td className="px-3 py-2 text-gray-500 font-mono text-xs">
                          {item.item_code || "-"}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {item.quantity || 1}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          ₹
                          {Number(
                            item.total_taxable_amt ||
                              item.taxable_price ||
                              item.total_price ||
                              0
                          ).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {selectedCount > 0 && (
              <p className="text-sm text-orange-700 font-medium mb-4">
                {selectedCount} product{selectedCount > 1 ? "s" : ""} selected for
                return
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCreditNote}
                disabled={submitting || selectedCount === 0 || loadingItems}
                className="px-5 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                {submitting ? "Creating…" : "Create Credit Note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
