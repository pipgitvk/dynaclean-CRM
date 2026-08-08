"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";

async function resolvePriceWithSpecial(customerId, productCode, basePrice, itemType = null) {
  if (!customerId || !productCode) {
    return { finalPrice: basePrice, specialPrice: null };
  }

  try {
    const specialRes = await fetch("/api/special-price/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: Number(customerId) || customerId,
        product_code: productCode,
        item_type: itemType || undefined,
      }),
    });

    const specialData = await specialRes.json();
    if (specialRes.ok && specialData?.special_price != null && specialData.special_price !== "") {
      const specialPrice = parseFloat(specialData.special_price);
      if (Number.isFinite(specialPrice)) {
        return { finalPrice: specialPrice, specialPrice };
      }
    }
  } catch (err) {
    console.error("❌ Special price fetch error", err);
  }

  return { finalPrice: basePrice, specialPrice: null };
}

export default function QuotationTable({ items, setItems, customerId }) {
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [activeRowIndex, setActiveRowIndex] = useState(null);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const handleChange = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      if (field === "quantity" || field === "price" || field === "gst") {
        updated[index][field] = parseFloat(value) || 0;
      } else {
        updated[index][field] = value;
      }
      return updated;
    });
  };

  const handleBlur = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      if (field === "price") {
        const newValue = parseFloat(value) || 0;
        const lastNegPrice = updated[index].last_negotiation_price || 0;
        if (newValue < lastNegPrice) {
          alert(`Price cannot be lower than the Last Negotiation Price: ₹${lastNegPrice}`);
          updated[index][field] = lastNegPrice;
        }
      }
      return updated;
    });
  };

  const fetchProductDetails = async (code, index, isSuggestion = false, itemType = null) => {
    try {
      const customerParam = customerId
        ? `&customerId=${encodeURIComponent(customerId)}`
        : "";
      const res = await fetch(
        `/api/get-product-details?code=${encodeURIComponent(code)}&mode=${isSuggestion ? "suggestion" : "full"}${customerParam}`
      );
      const data = await res.json();
      if (!res.ok || !Array.isArray(data) || data.length === 0) {
        if (!res.ok) {
          console.error("❌ Product fetch failed:", data);
        }
        return;
      }

      if (isSuggestion) {
        setProductSuggestions(data);
        setActiveRowIndex(index);
        return;
      }

      const item = data[0];
      const resolvedCode = item.item_code || code;
      const resolvedType = itemType || item.item_type || item.source || "product";
      const basePrice = parseFloat(item.price_per_unit) || 0;

      // Live price from special_price table (product + spare)
      let specialPrice = null;
      if (customerId) {
        const resolved = await resolvePriceWithSpecial(
          customerId,
          resolvedCode,
          basePrice,
          resolvedType
        );
        specialPrice = resolved.specialPrice;
      } else if (item.special_price != null) {
        const parsed = parseFloat(item.special_price);
        if (Number.isFinite(parsed)) specialPrice = parsed;
      }

      const finalPrice =
        specialPrice != null && Number.isFinite(specialPrice)
          ? specialPrice
          : basePrice;

      const imageUrl = item.image_path || "";

      setItems(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          productCode: resolvedCode,
          item_type: resolvedType,
          name: item.item_name || "",
          hsn: item.hsn_sac || "",
          specification: item.specification || "",
          unit: item.unit || "",
          price: finalPrice,
          original_price:
            parseFloat(item.original_price) ||
            parseFloat(item.price_per_unit) ||
            0,
          special_price: specialPrice,
          last_negotiation_price: parseFloat(item.last_negotiation_price) || 0,
          gst: parseFloat(item.gst_rate) || 18,
          imageUrl,
        };
        return updated;
      });
      setProductSuggestions([]);
    } catch (err) {
      console.error("❌ Product fetch error", err);
    }
  };

  const reapplySpecialPrices = useCallback(async () => {
    if (!customerId) return;

    const prev = itemsRef.current;
    if (!prev.some((i) => String(i.productCode ?? "").trim())) return;

    const next = await Promise.all(
      prev.map(async (row) => {
        const code = String(row.productCode ?? "").trim();
        if (!code) return row;
        const base =
          parseFloat(row.original_price) || parseFloat(row.price) || 0;
        const { specialPrice } = await resolvePriceWithSpecial(
          customerId,
          code,
          base,
          row.item_type || null
        );
        if (specialPrice == null) return row;
        return { ...row, price: specialPrice, special_price: specialPrice };
      })
    );

    setItems(next);
  }, [customerId, setItems]);

  useEffect(() => {
    reapplySpecialPrices();
  }, [customerId, reapplySpecialPrices]);

  const addRow = () => {
    setItems(prev => [
      ...prev,
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
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const totals = items.reduce(
    (acc, item) => {
      const taxable = (item.quantity || 0) * (item.price || 0);
      const gstAmt = taxable * ((item.gst || 0) / 100);
      acc.totalQty += item.quantity || 0;
      acc.totalTaxable += taxable;
      acc.totalGst += gstAmt;
      acc.grandTotal += taxable + gstAmt;
      return acc;
    },
    { totalQty: 0, totalTaxable: 0, totalGst: 0, grandTotal: 0 }
  );

  return (
    <div className="overflow-x-auto border mt-4 rounded">
      <table className="min-w-[900px] w-full text-sm text-left border">
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
            <th className="border px-2 py-2">GST %</th>
            <th className="border px-2 py-2">Taxable</th>
            <th className="border px-2 py-2">GST Amt</th>
            <th className="border px-2 py-2">Total</th>
            <th className="border px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const taxable = (item.quantity || 0) * (item.price || 0);
            const gstAmt = taxable * ((item.gst || 0) / 100);
            const total = taxable + gstAmt;

            return (
              <tr key={idx} className="border-t">
                <td className="border px-2 py-2">{idx + 1}</td>
                <td className="border px-2 py-2">
                  {item?.imageUrl ? (
                    <Image
                      src={item?.imageUrl}
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
                              key={`${p.source || "product"}-${p.item_code}-${i}`}
                              onClick={() => {
                                handleChange(idx, "productCode", p.item_code);
                                fetchProductDetails(
                                  p.item_code,
                                  idx,
                                  false,
                                  p.source || "product"
                                );
                                setProductSuggestions([]);
                              }}
                              className="px-2 py-1 cursor-pointer hover:bg-emerald-100"
                            >
                              <span
                                className={`mr-1 px-1 rounded text-[10px] font-semibold ${
                                  p.source === "spare"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {p.source === "spare" ? "Spare" : "Product"}
                              </span>
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
                <td className="border px-2 py-2">
                  <input
                    type="number"
                    value={item.gst ?? 18}
                    onChange={(e) => handleChange(idx, "gst", e.target.value)}
                    className="border p-1 w-16 text-xs rounded text-center"
                    min="0"
                    step="0.5"
                  />
                </td>
                <td className="border px-2 py-2">₹ {taxable.toFixed(2)}</td>
                <td className="border px-2 py-2">₹ {gstAmt.toFixed(2)}</td>
                <td className="border px-2 py-2 font-medium">₹ {total.toFixed(2)}</td>
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

          <tr className="font-semibold bg-gray-100 text-xs">
            <td className="border px-2 py-2 text-center" colSpan={6}>Total</td>
            <td className="border px-2 py-2">{totals.totalQty}</td>
            <td className="border px-2 py-2"></td>
            <td className="border px-2 py-2"></td>
            <td className="border px-2 py-2"></td>
            <td className="border px-2 py-2">₹ {totals.totalTaxable.toFixed(2)}</td>
            <td className="border px-2 py-2">₹ {totals.totalGst.toFixed(2)}</td>
            <td className="border px-2 py-2">₹ {totals.grandTotal.toFixed(2)}</td>
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
          + Add Product / Spare
        </button>
      </div>
    </div>
  );
}
