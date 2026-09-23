"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import dayjs from "dayjs";

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-500 mb-1.5">
        {label}
      </label>
      <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700 break-words">
        {value || "-"}
      </div>
    </div>
  );
}

function getStatusLabel(status) {
  const normalized = status || "pending";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function buildDisplayDetails(booking) {
  if (!booking) {
    return {
      customerName: "-",
      company: "-",
      leadSource: "-",
      productName: "-",
      expectedDate: "-",
    };
  }

  return {
    customerName:
      [booking.first_name, booking.last_name].filter(Boolean).join(" ").trim() ||
      "N/A",
    company: booking.company || "-",
    leadSource: booking.lead_source || "-",
    productName: booking.product_name || "-",
    expectedDate: booking.expected_date
      ? dayjs(booking.expected_date).format("DD MMM YYYY")
      : "-",
  };
}

function customerToDisplayFields(customer) {
  return {
    customerName:
      [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() ||
      customer.customer_name ||
      "N/A",
    company: customer.company || "-",
    leadSource: customer.lead_source || "-",
  };
}

function toDateInputValue(value) {
  if (!value) return "";
  return dayjs(value).format("YYYY-MM-DD");
}

const STATUS_OPTIONS = [
  "pending",
  "partial",
  "received",
  "cancelled",
  "postponed",
];

const REMARK_TYPE_OPTIONS = [
  { value: "", label: "None" },
  { value: "cancelled", label: "Order Cancelled" },
  { value: "postponed", label: "Order Postponed" },
];

export default function PreBookingEditModal({
  isOpen,
  onClose,
  booking,
  onSuccess,
}) {
  const [customerId, setCustomerId] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [status, setStatus] = useState("pending");
  const [orderId, setOrderId] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [remarkType, setRemarkType] = useState("");
  const [remarkReason, setRemarkReason] = useState("");
  const [postponedDate, setPostponedDate] = useState("");
  const [displayDetails, setDisplayDetails] = useState(buildDisplayDetails(null));
  const [loading, setLoading] = useState(false);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [orderSuggestions, setOrderSuggestions] = useState([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);
  const [showOrderSuggestions, setShowOrderSuggestions] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [searchingItem, setSearchingItem] = useState(false);
  const [searchingOrder, setSearchingOrder] = useState(false);
  const customerSearchTimerRef = useRef(null);
  const itemSearchTimerRef = useRef(null);
  const orderSearchTimerRef = useRef(null);
  const customerLookupTimerRef = useRef(null);

  useEffect(() => {
    if (isOpen && booking) {
      setCustomerId(String(booking.customer_id ?? ""));
      setItemCode(booking.item_code ?? "");
      setQuantity(String(booking.quantity ?? 1));
      setStatus(booking.status || "pending");
      setOrderId(booking.order_id ? String(booking.order_id) : "");
      setReceivedDate(toDateInputValue(booking.received_date));
      setRemarkType(booking.remark_type || "");
      setRemarkReason(booking.remark_reason || "");
      setPostponedDate(toDateInputValue(booking.postponed_date));
      setDisplayDetails(buildDisplayDetails(booking));
      setCustomerSuggestions([]);
      setItemSuggestions([]);
      setOrderSuggestions([]);
      setShowCustomerSuggestions(false);
      setShowItemSuggestions(false);
      setShowOrderSuggestions(false);
    }
  }, [isOpen, booking]);

  useEffect(() => {
    if (!isOpen) return;

    const trimmedId = customerId.trim();
    if (!trimmedId) {
      setDisplayDetails((prev) => ({
        ...prev,
        customerName: "-",
        company: "-",
        leadSource: "-",
      }));
      return;
    }

    if (customerLookupTimerRef.current) {
      clearTimeout(customerLookupTimerRef.current);
    }

    customerLookupTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/customers/search?q=${encodeURIComponent(trimmedId)}&limit=10`,
          { credentials: "include" },
        );
        const data = await response.json();
        const match = (data.data || []).find(
          (customer) => String(customer.customer_id) === trimmedId,
        );

        if (match) {
          setDisplayDetails((prev) => ({
            ...prev,
            ...customerToDisplayFields(match),
          }));
        }
      } catch (error) {
        console.error("Error looking up customer:", error);
      }
    }, 350);

    return () => {
      if (customerLookupTimerRef.current) {
        clearTimeout(customerLookupTimerRef.current);
      }
    };
  }, [customerId, isOpen]);

  const fetchCustomerSuggestions = async (term) => {
    setSearchingCustomer(true);
    setShowCustomerSuggestions(true);

    try {
      const response = await fetch(
        `/api/customers/search?q=${encodeURIComponent(term)}&limit=10`,
        { credentials: "include" },
      );
      const data = await response.json();
      setCustomerSuggestions(data.success ? data.data || [] : []);
    } catch (error) {
      console.error("Error fetching customer suggestions:", error);
      setCustomerSuggestions([]);
    } finally {
      setSearchingCustomer(false);
    }
  };

  const fetchItemSuggestions = async (term) => {
    setSearchingItem(true);
    setShowItemSuggestions(true);

    try {
      const response = await fetch(
        `/api/pre-booking-suggestions?type=itemcode&search=${encodeURIComponent(term)}`,
        { credentials: "include" },
      );
      const data = await response.json();
      const suggestions = data.success ? data.suggestions || [] : [];
      setItemSuggestions(suggestions);

      const exactMatch = suggestions.find(
        (item) => String(item.id).toLowerCase() === term.trim().toLowerCase(),
      );
      if (exactMatch) {
        setDisplayDetails((prev) => ({
          ...prev,
          productName: exactMatch.item_name || "-",
        }));
      }
    } catch (error) {
      console.error("Error fetching item suggestions:", error);
      setItemSuggestions([]);
    } finally {
      setSearchingItem(false);
    }
  };

  const fetchOrderSuggestions = async (term) => {
    setSearchingOrder(true);
    setShowOrderSuggestions(true);

    try {
      const params = new URLSearchParams({
        type: "orderid",
        search: term,
      });
      if (!term.trim() && customerId.trim()) {
        params.set("customer_id", customerId.trim());
      }

      const response = await fetch(
        `/api/pre-booking-suggestions?${params.toString()}`,
        { credentials: "include" },
      );
      const data = await response.json();
      setOrderSuggestions(data.success ? data.suggestions || [] : []);
    } catch (error) {
      console.error("Error fetching order suggestions:", error);
      setOrderSuggestions([]);
    } finally {
      setSearchingOrder(false);
    }
  };

  const handleCustomerIdChange = (value) => {
    setCustomerId(value);

    if (customerSearchTimerRef.current) {
      clearTimeout(customerSearchTimerRef.current);
    }

    customerSearchTimerRef.current = setTimeout(() => {
      fetchCustomerSuggestions(value);
    }, 300);
  };

  const handleItemCodeChange = (value) => {
    setItemCode(value);

    if (itemSearchTimerRef.current) {
      clearTimeout(itemSearchTimerRef.current);
    }

    itemSearchTimerRef.current = setTimeout(() => {
      if (value.trim()) {
        fetchItemSuggestions(value);
      } else {
        setItemSuggestions([]);
        setShowItemSuggestions(false);
        setDisplayDetails((prev) => ({
          ...prev,
          productName: "-",
        }));
      }
    }, 300);
  };

  const handleSelectCustomerSuggestion = (customer) => {
    setCustomerId(String(customer.customer_id));
    setDisplayDetails((prev) => ({
      ...prev,
      ...customerToDisplayFields(customer),
    }));
    setCustomerSuggestions([]);
    setShowCustomerSuggestions(false);
  };

  const handleSelectItemSuggestion = (item) => {
    setItemCode(String(item.id || ""));
    setDisplayDetails((prev) => ({
      ...prev,
      productName: item.item_name || "-",
    }));
    setItemSuggestions([]);
    setShowItemSuggestions(false);
  };

  const handleOrderIdChange = (value) => {
    setOrderId(value);

    if (orderSearchTimerRef.current) {
      clearTimeout(orderSearchTimerRef.current);
    }

    orderSearchTimerRef.current = setTimeout(() => {
      fetchOrderSuggestions(value);
    }, 300);
  };

  const handleSelectOrderSuggestion = (order) => {
    setOrderId(String(order.id || ""));
    if (order.invoice_date) {
      setReceivedDate(toDateInputValue(order.invoice_date));
    }
    setOrderSuggestions([]);
    setShowOrderSuggestions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const normalizedCustomerId = customerId.trim();
    const normalizedItemCode = itemCode.trim();
    const parsedQty = parseInt(quantity, 10);

    if (!normalizedCustomerId) {
      toast.error("Please enter a customer ID");
      return;
    }

    if (!Number.isFinite(parsedQty) || parsedQty < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }

    if (remarkType === "cancelled" && !remarkReason.trim()) {
      toast.error("Please enter remark reason for cancelled order");
      return;
    }

    if (remarkType === "postponed") {
      if (!remarkReason.trim()) {
        toast.error("Please enter remark reason for postponed order");
        return;
      }
      if (!postponedDate) {
        toast.error("Please select postponed date");
        return;
      }
    }

    try {
      setLoading(true);
      const response = await fetch("/api/pre-booking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: booking.id,
          customer_id: normalizedCustomerId,
          item_code: normalizedItemCode || null,
          quantity: parsedQty,
          status,
          order_id: orderId.trim() || null,
          received_date: receivedDate || null,
          remark_type: remarkType || "",
          remark_reason: remarkReason.trim() || null,
          postponed_date:
            remarkType === "postponed" ? postponedDate || null : null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error(data.error || "Failed to update pre-booking");
        return;
      }

      toast.success("Pre-booking updated successfully");
      onSuccess?.(data.booking);
      onClose();
    } catch (error) {
      console.error("Error updating pre-booking:", error);
      toast.error("Failed to update pre-booking");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !booking) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Edit Pre-Booking</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Product details update automatically from item code
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              Editable Fields
            </p>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerId}
                onChange={(e) => handleCustomerIdChange(e.target.value)}
                onFocus={() => fetchCustomerSuggestions(customerId)}
                onBlur={() => {
                  setTimeout(() => setShowCustomerSuggestions(false), 200);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search or enter customer ID"
                required
              />
              {showCustomerSuggestions && (
                <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  {searchingCustomer && (
                    <li className="px-3 py-2 text-xs text-gray-500">Searching...</li>
                  )}
                  {!searchingCustomer &&
                    customerSuggestions.map((customer) => {
                      const name =
                        [customer.first_name, customer.last_name]
                          .filter(Boolean)
                          .join(" ")
                          .trim() ||
                        customer.customer_name ||
                        "Unnamed";
                      return (
                        <li
                          key={customer.customer_id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectCustomerSuggestion(customer);
                          }}
                          className="cursor-pointer px-3 py-2 text-xs hover:bg-blue-50 border-b last:border-b-0"
                        >
                          <div className="font-semibold text-gray-800">
                            ID: {customer.customer_id}
                          </div>
                          <div className="text-gray-600">{name}</div>
                          <div className="text-gray-500">
                            {[customer.company, customer.phone]
                              .filter(Boolean)
                              .join(" • ")}
                          </div>
                        </li>
                      );
                    })}
                  {!searchingCustomer && customerSuggestions.length === 0 && (
                    <li className="px-3 py-2 text-xs text-gray-500">
                      No customers found
                    </li>
                  )}
                </ul>
              )}
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item Code
              </label>
              <input
                type="text"
                value={itemCode}
                onChange={(e) => handleItemCodeChange(e.target.value)}
                onFocus={() => itemCode.trim() && fetchItemSuggestions(itemCode)}
                onBlur={() => {
                  setTimeout(() => setShowItemSuggestions(false), 200);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="Search product item code"
              />
              {showItemSuggestions && (
                <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  {searchingItem && (
                    <li className="px-3 py-2 text-xs text-gray-500">Searching...</li>
                  )}
                  {!searchingItem &&
                    itemSuggestions.map((item) => (
                      <li
                        key={`${item.id}-${item.item_name}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectItemSuggestion(item);
                        }}
                        className="cursor-pointer px-3 py-2 text-xs hover:bg-blue-50 border-b last:border-b-0"
                      >
                        <div className="font-semibold text-gray-800 font-mono">
                          {item.id}
                        </div>
                        <div className="text-gray-600">{item.item_name}</div>
                        <div className="text-gray-500">{item.label}</div>
                      </li>
                    ))}
                  {!searchingItem && itemSuggestions.length === 0 && (
                    <li className="px-3 py-2 text-xs text-gray-500">
                      No products found
                    </li>
                  )}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                required
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {getStatusLabel(option)}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order ID
              </label>
              <input
                type="text"
                value={orderId}
                onChange={(e) => handleOrderIdChange(e.target.value)}
                onFocus={() => fetchOrderSuggestions(orderId)}
                onBlur={() => {
                  setTimeout(() => setShowOrderSuggestions(false), 200);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search order from order process"
              />
              {showOrderSuggestions && (
                <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  {searchingOrder && (
                    <li className="px-3 py-2 text-xs text-gray-500">Searching...</li>
                  )}
                  {!searchingOrder &&
                    orderSuggestions.map((order) => (
                      <li
                        key={order.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectOrderSuggestion(order);
                        }}
                        className="cursor-pointer px-3 py-2 text-xs hover:bg-blue-50 border-b last:border-b-0"
                      >
                        <div className="font-semibold text-gray-800">
                          Order: {order.id}
                        </div>
                        <div className="text-gray-600">
                          {order.client_name || "Unnamed customer"}
                        </div>
                        <div className="text-gray-500">
                          {[
                            order.customer_id ? `Customer ${order.customer_id}` : null,
                            order.quote_number ? `Quote ${order.quote_number}` : null,
                            order.approval_status
                              ? getStatusLabel(order.approval_status)
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </div>
                      </li>
                    ))}
                  {!searchingOrder && orderSuggestions.length === 0 && (
                    <li className="px-3 py-2 text-xs text-gray-500">
                      No orders found
                    </li>
                  )}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Received Date
              </label>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Remark Type
              </label>
              <select
                value={remarkType}
                onChange={(e) => setRemarkType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {REMARK_TYPE_OPTIONS.map((option) => (
                  <option key={option.value || "none"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {remarkType && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remark Reason
                </label>
                <textarea
                  value={remarkReason}
                  onChange={(e) => setRemarkReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Write remark reason..."
                />
              </div>
            )}

            {remarkType === "postponed" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Postponed Date
                </label>
                <input
                  type="date"
                  value={postponedDate}
                  onChange={(e) => setPostponedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <div className="space-y-4 pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Other Details (Read Only)
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ReadOnlyField
                label="Customer Name"
                value={displayDetails.customerName}
              />
              <ReadOnlyField label="Company" value={displayDetails.company} />
              <ReadOnlyField
                label="Lead Source"
                value={displayDetails.leadSource}
              />
              <ReadOnlyField
                label="Product Name"
                value={displayDetails.productName}
              />
              <ReadOnlyField
                label="Expected Date"
                value={displayDetails.expectedDate}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
