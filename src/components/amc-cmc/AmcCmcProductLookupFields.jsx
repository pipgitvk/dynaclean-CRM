"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import AmcCmcOrderDetailsPanel from "@/components/amc-cmc/AmcCmcOrderDetailsPanel";
import {
  applySerialLookupToAmcForm,
  fetchAmcOrderBySerial,
  fetchAmcOrderByOrderId,
} from "@/components/amc-cmc/fetchAmcOrderLookup";

/**
 * Order ID + serial inputs with autocomplete and linked order panel.
 * Updates parent formData via setFormData.
 */
export default function AmcCmcProductLookupFields({
  formData,
  setFormData,
  dashboardBase = "admin-dashboard",
}) {
  const [serialSuggestions, setSerialSuggestions] = useState([]);
  const [showSerialSuggestions, setShowSerialSuggestions] = useState(false);
  const [orderIdInput, setOrderIdInput] = useState("");
  const [orderSuggestions, setOrderSuggestions] = useState([]);
  const [showOrderSuggestions, setShowOrderSuggestions] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [machines, setMachines] = useState([]);
  const [lookupSource, setLookupSource] = useState(null);

  const serialTimer = useRef(null);
  const orderTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (serialTimer.current) clearTimeout(serialTimer.current);
      if (orderTimer.current) clearTimeout(orderTimer.current);
    };
  }, []);

  const buildPanelPayload = useCallback(
    (apiPayload, source) => {
      if (!apiPayload?.found) {
        return {
          found: false,
          source,
        };
      }
      return {
        found: true,
        source,
        order: apiPayload.order,
      };
    },
    [],
  );

  const applyMachine = useCallback(
    (machine, orderPayload) => {
      const suggestion = machine
        ? {
            serial_number: machine.serial_number,
            model: machine.model,
            customer_name: machine.customer_name,
            contact: machine.contact,
            email: machine.email,
            customer_address: machine.customer_address,
          }
        : null;

      const serialPayload = machine?.serial_number
        ? {
            found: true,
            serial: machine.serial_number,
            order: { ...orderPayload.order, ...machine },
          }
        : orderPayload?.found
          ? {
              found: true,
              order: orderPayload.order,
            }
          : null;

      setFormData((prev) =>
        applySerialLookupToAmcForm(prev, {
          suggestion,
          orderPayload: serialPayload || orderPayload,
        }),
      );

      if (machine?.site_address) {
        setFormData((prev) => ({
          ...prev,
          site_address: prev.site_address || machine.site_address,
        }));
      }
    },
    [setFormData],
  );

  const lookupOrderForSerial = useCallback(
    async (serial, suggestion = null) => {
      const sn = String(serial || "").trim();
      if (!sn) {
        setOrderDetails(null);
        setMachines([]);
        return;
      }
      setOrderLoading(true);
      setLookupSource("serial");
      try {
        const { payload } = await fetchAmcOrderBySerial(sn);
        setOrderDetails(buildPanelPayload(payload, "serial"));
        setMachines([]);
        if (payload) {
          setFormData((prev) =>
            applySerialLookupToAmcForm(prev, {
              suggestion,
              orderPayload: payload,
            }),
          );
        }
      } catch (err) {
        console.error(err);
        setOrderDetails(null);
        toast.error(err.message || "Could not load order details");
      } finally {
        setOrderLoading(false);
      }
    },
    [buildPanelPayload, setFormData],
  );

  const lookupByOrderId = useCallback(
    async (orderId, machine = null) => {
      const oid = String(orderId || "").trim();
      if (!oid) {
        setOrderDetails(null);
        setMachines([]);
        return;
      }
      setOrderLoading(true);
      setLookupSource("order");
      setOrderIdInput(oid);
      try {
        const { payload } = await fetchAmcOrderByOrderId(oid);
        setOrderDetails(buildPanelPayload(payload, "order"));
        setMachines(payload?.machines || []);

        if (!payload?.found) {
          return;
        }

        const pick =
          machine ||
          (payload.machines?.length === 1 ? payload.machines[0] : null);

        if (pick) {
          applyMachine(pick, payload);
        } else {
          setFormData((prev) =>
            applySerialLookupToAmcForm(prev, {
              suggestion: null,
              orderPayload: {
                found: true,
                order: payload.order,
              },
            }),
          );
        }
      } catch (err) {
        console.error(err);
        setOrderDetails(null);
        setMachines([]);
        toast.error(err.message || "Could not load order");
      } finally {
        setOrderLoading(false);
      }
    },
    [applyMachine, buildPanelPayload, setFormData],
  );

  const fetchSerialSuggestions = useCallback(async (searchTerm) => {
    if (!searchTerm?.trim()) {
      setSerialSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/warranty/serial-numbers?search=${encodeURIComponent(searchTerm)}`,
      );
      if (!res.ok) throw new Error("Failed to fetch suggestions");
      const data = await res.json();
      setSerialSuggestions(data.data || []);
    } catch {
      setSerialSuggestions([]);
    }
  }, []);

  const fetchOrderSuggestions = useCallback(async (q) => {
    if (!q?.trim()) {
      setOrderSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/amc-cmc/order-by-order-id?q=${encodeURIComponent(q)}`,
      );
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setOrderSuggestions(data.suggestions || []);
    } catch {
      setOrderSuggestions([]);
    }
  }, []);

  const handleOrderIdChange = (e) => {
    const value = e.target.value;
    setOrderIdInput(value);
    fetchOrderSuggestions(value);
    setShowOrderSuggestions(true);
    if (orderTimer.current) clearTimeout(orderTimer.current);
    const trimmed = value.trim();
    if (trimmed.length >= 4) {
      orderTimer.current = setTimeout(() => lookupByOrderId(trimmed), 500);
    }
  };

  const handleSelectOrderSuggestion = (item) => {
    setOrderIdInput(item.order_id);
    setShowOrderSuggestions(false);
    setOrderSuggestions([]);
    lookupByOrderId(item.order_id);
  };

  const handleOrderBlur = () => {
    const trimmed = orderIdInput.trim();
    if (trimmed.length >= 3) lookupByOrderId(trimmed);
  };

  const handleSerialChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, serial_number: value }));
    fetchSerialSuggestions(value);
    setShowSerialSuggestions(true);
    if (serialTimer.current) clearTimeout(serialTimer.current);
    const trimmed = value.trim();
    if (trimmed.length >= 4) {
      serialTimer.current = setTimeout(() => lookupOrderForSerial(trimmed), 400);
    } else if (!trimmed) {
      if (lookupSource === "serial") {
        setOrderDetails(null);
        setMachines([]);
      }
    }
  };

  const handleSerialBlur = (e) => {
    const trimmed = String(e.target.value || "").trim();
    if (trimmed.length >= 3) lookupOrderForSerial(trimmed);
  };

  const handleSelectSerialSuggestion = (suggestion) => {
    setFormData((prev) =>
      applySerialLookupToAmcForm(prev, { suggestion, orderPayload: null }),
    );
    setShowSerialSuggestions(false);
    setSerialSuggestions([]);
    if (suggestion.order_id) setOrderIdInput(suggestion.order_id);
    lookupOrderForSerial(suggestion.serial_number, suggestion);
  };

  const panelTitle =
    lookupSource === "order"
      ? "Linked order (from Order ID)"
      : "Linked order (from serial)";

  return (
    <>
      <div className="relative md:col-span-2">
        <label className="block text-sm font-medium mb-1">
          Search by Order ID
        </label>
        <input
          type="text"
          value={orderIdInput}
          onChange={handleOrderIdChange}
          onBlur={handleOrderBlur}
          autoComplete="off"
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Type order ID e.g. 20251023001"
        />
        {showOrderSuggestions && orderSuggestions.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {orderSuggestions.map((item) => (
              <button
                key={item.order_id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelectOrderSuggestion(item)}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-b-0"
              >
                <div className="font-semibold text-gray-900">{item.order_id}</div>
                <div className="text-sm text-gray-600">
                  {item.quote_number && (
                    <span>Quote: {item.quote_number} · </span>
                  )}
                  {item.company_name}
                  {item.invoice_number ? ` · Inv: ${item.invoice_number}` : ""}
                </div>
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Enter an Order ID to load the quotation, invoice, and dispatched serial
          numbers. Pick a serial below, or one will auto-fill when only one machine
          is on the order.
        </p>
      </div>

      {machines.length > 1 && (
        <div className="md:col-span-2 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3">
          <p className="text-sm font-medium text-indigo-900 mb-2">
            This order has multiple serial numbers — choose one for this AMC/CMC:
          </p>
          <div className="flex flex-wrap gap-2">
            {machines.map((m) => (
              <button
                key={`${m.dispatch_id}-${m.serial_number}`}
                type="button"
                onClick={() => applyMachine(m, { found: true, order: m })}
                className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
                  formData.serial_number === m.serial_number
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-indigo-800 border-indigo-300 hover:bg-indigo-100"
                }`}
              >
                {m.serial_number}
                {m.model ? ` (${m.model})` : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <label className="block text-sm font-medium mb-1">Serial Number *</label>
        <input
          type="text"
          name="serial_number"
          value={formData.serial_number}
          onChange={handleSerialChange}
          onBlur={handleSerialBlur}
          onFocus={() =>
            showSerialSuggestions &&
            serialSuggestions.length > 0 &&
            setShowSerialSuggestions(true)
          }
          required
          autoComplete="off"
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Start typing to search..."
        />
        {showSerialSuggestions && serialSuggestions.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {serialSuggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelectSerialSuggestion(suggestion)}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-b-0"
              >
                <div className="font-semibold text-gray-900">
                  {suggestion.serial_number}
                </div>
                <div className="text-sm text-gray-600">
                  {suggestion.product_name && (
                    <div>Product: {suggestion.product_name}</div>
                  )}
                  {suggestion.model && <div>Model: {suggestion.model}</div>}
                  {suggestion.customer_name && (
                    <div>Company: {suggestion.customer_name}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <AmcCmcOrderDetailsPanel
        orderDetails={orderDetails}
        loading={orderLoading}
        dashboardBase={dashboardBase}
        title={panelTitle}
      />
    </>
  );
}
