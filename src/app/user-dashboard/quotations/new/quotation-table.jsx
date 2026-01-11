"use client";

import { useState } from "react";
import Image from "next/image";

export default function QuotationItemsTable({ items, setItems }) {
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [activeRowIndex, setActiveRowIndex] = useState(null);

  const handleChange = (index, field, value) => {
    const updated = [...items];
    let newValue = value;

    if (field === "quantity" || field === "price" || field === "gst") {
      newValue = parseFloat(value) || 0;
    }

    updated[index][field] = newValue;
    setItems(updated);
  };

  const handleBlur = (index, field, value) => {
    const updated = [...items];
    let newValue = parseFloat(value) || 0;

    // Validation
    if (field === "price") {
      const lastNegPrice = updated[index].last_negotiation_price || 0;
      if (newValue < lastNegPrice) {
        alert(`Price cannot be lower than the Last Negotiation Price: ₹${lastNegPrice}`);
        newValue = lastNegPrice;
        updated[index][field] = newValue;
        setItems(updated);
      }
    }
  };

  const fetchProductDetails = async (code, index, isSuggestion = false) => {
    try {
      const res = await fetch(
        `/api/get-product-details?code=${code}&mode=${isSuggestion ? "suggestion" : "full"
        }`
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
        productCode: item.item_code || code,
        name: item.item_name || "",
        hsn: item.hsn_sac || "",
        specification: item.specification || "",
        unit: item.unit || "",
        quantity: updated[index].quantity,
        price: parseFloat(item.price_per_unit) || 0,
        last_negotiation_price: parseFloat(item.last_negotiation_price) || 0,
        gst: parseFloat(item.gst_rate) || 18,
        imageUrl,
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
        productCode: "",
        imageUrl: "",
        name: "",
        hsn: "",
        specification: "",
        unit: "",
        quantity: 1,
        price: 0,
        gst: 18,
      },
    ]);
  };

  const removeRow = (index) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  return (
    <div className="overflow-x-auto border mt-4 rounded">
      <table className="min-w-[800px] w-full text-sm text-left border">
        <thead className="bg-gray-100 text-xs font-semibold text-gray-700">
          <tr>
            <th className="border px-2 py-2">#</th>
            <th className="border px-2 py-2">Image</th>
            <th className="border px-2 py-2">Name</th>
            <th className="border px-2 py-2">Code</th>
            <th className="border px-2 py-2">HSN</th>
            <th className="border px-2 py-2">Specification</th>
            <th className="border px-2 py-2">Qty</th>
            <th className="border px-2 py-2">Unit</th>
            <th className="border px-2 py-2">Price/Unit</th>
            <th className="border px-2 py-2">GST Amt</th>
            <th className="border px-2 py-2">Total</th>
            <th className="border px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const taxable = item.quantity * item.price;
            const gstAmount = taxable * (item.gst / 100);
            const total = taxable + gstAmount;

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
                    />
                  ) : (
                    "-"
                  )}
                </td>
                <td className="border px-2 py-2">{item.name || "-"}</td>
                <td className="border px-2 py-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={item.productCode || ""}
                      onChange={(e) => {
                        handleChange(idx, "productCode", e.target.value);
                        fetchProductDetails(e.target.value, idx, true);
                      }}
                      className="border p-1 w-24 text-xs rounded"
                    />
                    {activeRowIndex === idx &&
                      productSuggestions.length > 0 && (
                        <ul className="absolute z-10 bg-white border rounded shadow-sm mt-1 max-h-40 overflow-y-auto w-48 text-xs">
                          {productSuggestions.map((p, i) => (
                            <li
                              key={i}
                              onClick={() => {
                                handleChange(idx, "productCode", p.item_code);
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
                <td className="border px-2 py-2">{item.hsn || "-"}</td>
                <td className="border px-2 py-2 align-top">
                  <textarea
                    value={item.specification || ""}
                    onChange={(e) =>
                      handleChange(idx, "specification", e.target.value)
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
                  />
                </td>
                <td className="border px-2 py-2">{item.unit || "-"}</td>
                <td className="border px-2 py-2">
                  <input
                    type="number"
                    value={item.price ?? 0}
                    onChange={(e) => handleChange(idx, "price", e.target.value)}
                    onBlur={(e) => handleBlur(idx, "price", e.target.value)}
                    className="border p-1 w-24 text-xs rounded"
                  />
                </td>
                <td className="border px-2 py-2 hidden">
                  <input
                    type="number"
                    value={item.gst ?? 0}
                    onChange={(e) => handleChange(idx, "gst", e.target.value)}
                    className="border p-1 w-16 text-xs rounded"
                  />
                </td>
                <td className="border px-2 py-2">₹ {gstAmount.toFixed(2)}</td>
                <td className="border px-2 py-2">₹ {total.toFixed(2)}</td>
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
