"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, X } from "lucide-react";
import Image from "next/image";

export default function AddDeliveryChallanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    delivery_challan_for: "",
    ship_to: "",
    transportation_mode: "",
    vehicle_no: "",
    driver_name: "",
    driver_contact: "",
    delivery_date: "",
    delivery_location: "",
    challan_no: "",
    challan_date: "",
    remarks: "",
  });

  const [items, setItems] = useState([
    {
      productCode: "",
      imageUrl: "",
      name: "",
      hsn: "",
      specification: "",
      unit: "",
      quantity: 1,
      price: 0,
    },
  ]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    if (field === "quantity" || field === "price") {
      updated[index][field] = parseFloat(value) || 0;
    } else {
      updated[index][field] = value;
    }
    setItems(updated);
  };

  const fetchProductDetails = async (code, index, isSuggestion = false) => {
    try {
      const res = await fetch(
        `/api/get-product-details?code=${code}&mode=${isSuggestion ? "suggestion" : "full"}`
      );
      const data = await res.json();

      if (!data || data.length === 0) return;

      if (isSuggestion) {
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === index ? { ...item, suggestions: data } : item
          )
        );
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
        price: parseFloat(item.price_per_unit) || 0,
        imageUrl,
        suggestions: [],
      };
      setItems(updated);
    } catch (err) {
      console.error("Product fetch error", err);
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
      },
    ]);
  };

  const removeRow = (index) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  const calculateTotals = () => {
    return items.reduce(
      (acc, item) => {
        const taxable = item.quantity * item.price;
        acc.totalQty += item.quantity;
        acc.totalTaxable += taxable;
        return acc;
      },
      { totalQty: 0, totalTaxable: 0 }
    );
  };

  const totals = calculateTotals();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const transportation_details = JSON.stringify({
        mode: formData.transportation_mode,
        vehicle_no: formData.vehicle_no,
        driver_name: formData.driver_name,
        driver_contact: formData.driver_contact,
      });

      const response = await fetch("/api/admin/delivery-challan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          delivery_challan_for: formData.delivery_challan_for,
          ship_to: formData.ship_to,
          transportation_details,
          delivery_date: formData.delivery_date,
          delivery_location: formData.delivery_location,
          challan_no: formData.challan_no,
          challan_date: formData.challan_date,
          items,
          remarks: formData.remarks,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create delivery challan");
      }

      router.push("/admin-dashboard/delivery-challan");
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg bg-white hover:bg-gray-50 border border-gray-200 shadow-sm transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-700">Add Delivery Challan</h1>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <X size={18} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-xl border border-gray-200 p-6 space-y-6">
        {/* Delivery Challan For & Ship To */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Challan For *
            </label>
            <input
              type="text"
              name="delivery_challan_for"
              value={formData.delivery_challan_for}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              placeholder="Enter delivery challan for"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ship To *
            </label>
            <input
              type="text"
              name="ship_to"
              value={formData.ship_to}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              placeholder="Enter ship to address"
            />
          </div>
        </div>

        {/* Transportation Details Section */}
        <div className="border border-gray-200 rounded-lg p-4 space-y-4">
          <h3 className="text-lg font-semibold text-gray-700">Transportation Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transportation Mode
              </label>
              <select
                name="transportation_mode"
                value={formData.transportation_mode}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              >
                <option value="">Select Mode</option>
                <option value="truck">Truck</option>
                <option value="van">Van</option>
                <option value="courier">Courier</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle No
              </label>
              <input
                type="text"
                name="vehicle_no"
                value={formData.vehicle_no}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder="Enter vehicle number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Driver Name
              </label>
              <input
                type="text"
                name="driver_name"
                value={formData.driver_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder="Enter driver name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Driver Contact
              </label>
              <input
                type="text"
                name="driver_contact"
                value={formData.driver_contact}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder="Enter driver contact number"
              />
            </div>
          </div>
        </div>

        {/* Delivery Date & Location */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Date *
            </label>
            <input
              type="date"
              name="delivery_date"
              value={formData.delivery_date}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Location *
            </label>
            <input
              type="text"
              name="delivery_location"
              value={formData.delivery_location}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              placeholder="Enter delivery location"
            />
          </div>
        </div>

        {/* Challan Details Section */}
        <div className="border border-gray-200 rounded-lg p-4 space-y-4">
          <h3 className="text-lg font-semibold text-gray-700">Challan Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Challan No *
              </label>
              <input
                type="text"
                name="challan_no"
                value={formData.challan_no}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder="Enter challan number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Challan Date *
              </label>
              <input
                type="date"
                name="challan_date"
                value={formData.challan_date}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Product Details Section */}
        <div className="border border-gray-200 rounded-lg p-4 space-y-4">
          <h3 className="text-lg font-semibold text-gray-700">Product Details</h3>
          
          <div className="overflow-x-auto">
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
                  <th className="border px-2 py-2">Taxable</th>
                  <th className="border px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const taxable = item.quantity * item.price;
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
                      <td className="border px-2 py-2">{item.name || "-"}</td>
                      <td className="border px-2 py-2">
                        <div className="relative">
                          <input
                            type="text"
                            value={item.productCode || ""}
                            onChange={(e) => {
                              handleItemChange(idx, "productCode", e.target.value);
                              fetchProductDetails(e.target.value, idx, true);
                            }}
                            className="border p-1 w-24 text-xs rounded"
                          />
                          {item.suggestions && item.suggestions.length > 0 && (
                            <ul className="absolute z-10 bg-white border rounded shadow-sm mt-1 max-h-40 overflow-y-auto w-48 text-xs">
                              {item.suggestions.map((p, i) => (
                                <li
                                  key={i}
                                  onClick={() => {
                                    handleItemChange(idx, "productCode", p.item_code);
                                    fetchProductDetails(p.item_code, idx, false);
                                  }}
                                  className="px-2 py-1 cursor-pointer hover:bg-blue-100"
                                >
                                  <span className="font-semibold">{p.item_code}</span> – {p.item_name}
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
                          onChange={(e) => handleItemChange(idx, "specification", e.target.value)}
                          className="w-full min-w-[180px] text-sm p-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={4}
                        />
                      </td>
                      <td className="border px-2 py-2">
                        <input
                          type="number"
                          value={item.quantity ?? 1}
                          onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                          className="border p-1 w-16 text-xs rounded"
                        />
                      </td>
                      <td className="border px-2 py-2">{item.unit || "-"}</td>
                      <td className="border px-2 py-2">
                        <input
                          type="number"
                          value={item.price ?? 0}
                          onChange={(e) => handleItemChange(idx, "price", e.target.value)}
                          className="border p-1 w-24 text-xs rounded"
                        />
                      </td>
                      <td className="border px-2 py-2">₹ {taxable.toFixed(2)}</td>
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
                  <td className="border px-2 py-2">{totals.totalQty}</td>
                  <td className="border px-2 py-2"></td>
                  <td className="border px-2 py-2"></td>
                  <td className="border px-2 py-2">₹ {totals.totalTaxable.toFixed(2)}</td>
                  <td className="border px-2 py-2"></td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <button
            type="button"
            onClick={addRow}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Add Product
          </button>
        </div>

        {/* Remarks */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Remarks
          </label>
          <textarea
            name="remarks"
            value={formData.remarks}
            onChange={handleChange}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
            placeholder="Enter any additional remarks"
          />
        </div>

        {/* Submit Button */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-fit inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            {loading ? "Saving..." : "Save Delivery Challan"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-medium rounded-lg shadow-sm hover:shadow transition-all"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
