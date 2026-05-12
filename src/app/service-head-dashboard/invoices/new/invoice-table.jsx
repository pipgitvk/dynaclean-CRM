"use client";

import { useState } from "react";
import Image from "next/image";

export default function InvoiceItemsTable({ items, setItems }) {
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [activeRowIndex, setActiveRowIndex] = useState(null);

  const handleChange = (index, field, value) => {
    const updated = [...items];
    let newValue = value;

    if (
      field === "quantity" ||
      field === "rate" ||
      field === "discount_percent" ||
      field === "discount_amount"
    ) {
      newValue = parseFloat(value) || 0;
    }

    updated[index][field] = newValue;

    // Auto-calculate discount amount from percentage
    if (field === "discount_percent") {
      const qty = updated[index].quantity || 0;
      const rate = updated[index].rate || 0;
      const discountPercent = parseFloat(value) || 0;
      updated[index].discount_amount = (qty * rate * discountPercent) / 100;
    }

    // Auto-calculate discount percentage from amount
    if (field === "discount_amount") {
      const qty = updated[index].quantity || 0;
      const rate = updated[index].rate || 0;
      const discountAmount = parseFloat(value) || 0;
      if (qty * rate > 0) {
        updated[index].discount_percent = (discountAmount / (qty * rate)) * 100;
      }
    }

    // Calculate taxable value
    const qty = updated[index].quantity || 0;
    const rate = updated[index].rate || 0;
    const discountAmount = updated[index].discount_amount || 0;
    updated[index].taxable_value = qty * rate - discountAmount;

    setItems(updated);
  };

  const handleBlur = (index, field, value) => {
    const updated = [...items];
    let newValue = parseFloat(value) || 0;

    // Validation: Check if rate is lower than last_negotiation_price
    if (field === "rate") {
      const lastNegPrice = updated[index].last_negotiation_price || 0;
      if (newValue < lastNegPrice) {
        alert(
          `Rate cannot be lower than the Last Negotiation Price: ₹${lastNegPrice}`,
        );
        newValue = lastNegPrice;
        updated[index][field] = newValue;
        setItems(updated);
      }
    }
  };

  const fetchProductDetails = async (code, index, isSuggestion = false) => {
    try {
      const res = await fetch(
        `/api/get-product-details?code=${code}&mode=${
          isSuggestion ? "suggestion" : "full"
        }`,
      );
      const data = await res.json();

      if (!data || data.length === 0) return;

      if (isSuggestion) {
        setProductSuggestions(data);
        setActiveRowIndex(index);
        return;
      }

      const item = data[0];

      const imageUrl = item.image_path || "";

      const updated = [...items];
      updated[index] = {
        ...updated[index],
        item_code: item.item_code || code,
        item_name: item.item_name || "",
        description: item.specification || "",
        hsn_code: item.hsn_sac || "",
        unit: item.unit || "",
        rate: parseFloat(item.price_per_unit) || 0,
        last_negotiation_price: parseFloat(item.last_negotiation_price) || 0,
        cgst_percent: parseFloat(item.gst_rate) / 2 || 9,
        sgst_percent: parseFloat(item.gst_rate) / 2 || 9,
        igst_percent: 0,
        imageUrl,
        quantity: updated[index].quantity || 1,
        discount_percent: 0,
        discount_amount: 0,
        taxable_value: parseFloat(item.price_per_unit) || 0,
      };
      setItems(updated);
      setProductSuggestions([]);
    } catch (err) {
      console.error("❌ Product fetch error", err);
    }
  };

  const addRow = () => {
    setItems([
      ...items,
      {
        item_code: "",
        imageUrl: "",
        item_name: "",
        description: "",
        hsn_code: "",
        unit: "",
        quantity: 1,
        rate: 0,
        discount_percent: 0,
        discount_amount: 0,
        taxable_value: 0,
        cgst_percent: 9,
        sgst_percent: 9,
        igst_percent: 0,
      },
    ]);
  };

  const removeRow = (index) => {
    if (items.length === 1) {
      alert("At least one item is required");
      return;
    }
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  const calculateTotals = () => {
    return items.reduce(
      (acc, item) => {
        const qty = item.quantity || 0;
        const rate = item.rate || 0;
        const discountAmount = item.discount_amount || 0;
        const taxable = qty * rate - discountAmount;

        acc.totalQty += qty;
        acc.totalTaxable += taxable;
        acc.totalDiscount += discountAmount;

        return acc;
      },
      { totalQty: 0, totalTaxable: 0, totalDiscount: 0 },
    );
  };

  const totals = calculateTotals();

  return (
    <div className="overflow-x-auto border mt-4 rounded">
      <table className="min-w-[1000px] w-full text-sm text-left border">
        <thead className="bg-gray-100 text-xs font-semibold text-gray-700">
          <tr>
            <th className="border px-2 py-2">#</th>
            <th className="border px-2 py-2">Image</th>
            <th className="border px-2 py-2">Item Name</th>
            <th className="border px-2 py-2">Code</th>
            <th className="border px-2 py-2">HSN</th>
            <th className="border px-2 py-2">Description</th>
            <th className="border px-2 py-2">Qty</th>
            <th className="border px-2 py-2">Unit</th>
            <th className="border px-2 py-2">Rate</th>
            <th className="border px-2 py-2">Disc %</th>
            <th className="border px-2 py-2">Disc ₹</th>
            <th className="border px-2 py-2">Taxable</th>
            <th className="border px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            return (
              <tr key={idx} className="border-t">
                <td className="border px-2 py-2">{idx + 1}</td>
                <td className="border px-2 py-2">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt="Product"
                      width={40}
                      height={40}
                      className="rounded object-cover"
                      unoptimized
                    />
                  ) : (
                    "-"
                  )}
                </td>
                <td className="border px-2 py-2">{item.item_name || "-"}</td>
                <td className="border px-2 py-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={item.item_code || ""}
                      onChange={(e) => {
                        handleChange(idx, "item_code", e.target.value);
                        fetchProductDetails(e.target.value, idx, true);
                      }}
                      className="border p-1 w-24 text-xs rounded"
                    />
                    {/* Dropdown */}
                    {activeRowIndex === idx &&
                      productSuggestions.length > 0 && (
                        <ul className="absolute z-10 bg-white border rounded shadow-sm mt-1 max-h-40 overflow-y-auto w-48 text-xs">
                          {productSuggestions.map((p, i) => (
                            <li
                              key={i}
                              onClick={() => {
                                handleChange(idx, "item_code", p.item_code);
                                fetchProductDetails(p.item_code, idx);
                                setProductSuggestions([]);
                              }}
                              className="px-2 py-1 cursor-pointer hover:bg-emerald-100"
                            >
                              <span className="font-semibold">
                                {p.item_code}
                              </span>{" "}
                              – {p.item_name}
                            </li>
                          ))}
                        </ul>
                      )}
                  </div>
                </td>
                <td className="border px-2 py-2">{item.hsn_code || "-"}</td>
                <td className="border px-2 py-2 align-top">
                  <textarea
                    value={item.description || ""}
                    onChange={(e) =>
                      handleChange(idx, "description", e.target.value)
                    }
                    className="w-full min-w-[180px] text-sm p-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    rows={4}
                  />
                </td>
                <td className="border px-2 py-2">
                  <input
                    type="number"
                    value={item.quantity ?? 1}
                    onChange={(e) =>
                      handleChange(idx, "quantity", e.target.value)
                    }
                    className="border p-1 w-16 text-xs rounded"
                    min="0"
                    step="0.01"
                  />
                </td>
                <td className="border px-2 py-2">{item.unit || "-"}</td>
                <td className="border px-2 py-2">
                  <input
                    type="number"
                    value={item.rate ?? 0}
                    onChange={(e) => handleChange(idx, "rate", e.target.value)}
                    onBlur={(e) => handleBlur(idx, "rate", e.target.value)}
                    className="border p-1 w-24 text-xs rounded"
                    min="0"
                    step="0.01"
                  />
                </td>
                <td className="border px-2 py-2">
                  <input
                    type="number"
                    value={item.discount_percent ?? 0}
                    onChange={(e) =>
                      handleChange(idx, "discount_percent", e.target.value)
                    }
                    className="border p-1 w-16 text-xs rounded"
                    min="0"
                    max="100"
                    step="0.01"
                  />
                </td>
                <td className="border px-2 py-2">
                  <input
                    type="number"
                    value={item.discount_amount ?? 0}
                    onChange={(e) =>
                      handleChange(idx, "discount_amount", e.target.value)
                    }
                    className="border p-1 w-20 text-xs rounded"
                    min="0"
                    step="0.01"
                  />
                </td>
                <td className="border px-2 py-2">
                  ₹ {(item.taxable_value || 0).toFixed(2)}
                </td>
                <td className="border px-2 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="text-red-500 hover:text-red-700"
                  >
                    🗑
                  </button>
                </td>
              </tr>
            );
          })}

          <tr className="font-semibold bg-gray-100">
            <td className="border px-2 py-2 text-center" colSpan={6}>
              Total
            </td>
            <td className="border px-2 py-2">{totals.totalQty.toFixed(2)}</td>
            <td className="border px-2 py-2"></td>
            <td className="border px-2 py-2"></td>
            <td className="border px-2 py-2"></td>
            <td className="border px-2 py-2">
              ₹ {totals.totalDiscount.toFixed(2)}
            </td>
            <td className="border px-2 py-2">
              ₹ {totals.totalTaxable.toFixed(2)}
            </td>
            <td className="border px-2 py-2"></td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={addRow}
          className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700 text-sm"
        >
          + Add Product
        </button>
      </div>
    </div>
  );
}
