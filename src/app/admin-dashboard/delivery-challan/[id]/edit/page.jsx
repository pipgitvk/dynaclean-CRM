"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Save, X } from "lucide-react";
import Image from "next/image";

export default function EditDeliveryChallanPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    delivery_challan_for: "",
    delivery_challan_for_address: "",
    delivery_challan_for_gstin: "",
    ship_to: "",
    ship_to_address: "",
    ship_to_gstin: "",
    transporter_name: "",
    transporter_gstin: "",
    lr_no: "",
    transportation_mode: "",
    vehicle_no: "",
    driver_name: "",
    driver_contact: "",
    expected_delivery_date: "",
    delivery_date: "",
    delivery_location: "",
    challan_no: "",
    challan_date: "",
    eway_bill: "",
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

  useEffect(() => {
    const fetchChallan = async () => {
      try {
        const response = await fetch(`/api/admin/delivery-challan/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch delivery challan");
        }
        const data = await response.json();
        const challan = data.data;

        // Parse transportation details
        let transportationDetails = {};
        try {
          transportationDetails = JSON.parse(challan.transportation_details || "{}");
        } catch (e) {
          console.error("Error parsing transportation details", e);
        }

        setFormData({
      delivery_challan_for: challan.delivery_challan_for || "",
      delivery_challan_for_address: challan.delivery_challan_for_address || "",
      delivery_challan_for_gstin: challan.delivery_challan_for_gstin || "",
      ship_to: challan.ship_to || "",
      ship_to_address: challan.ship_to_address || "",
      ship_to_gstin: challan.ship_to_gstin || "",
      transporter_name: transportationDetails.transporter_name || "",
      transporter_gstin: transportationDetails.transporter_gstin || "",
      lr_no: transportationDetails.lr_no || "",
      transportation_mode: transportationDetails.mode || "",
      vehicle_no: transportationDetails.vehicle_no || "",
      driver_name: transportationDetails.driver_name || "",
      driver_contact: transportationDetails.driver_contact || "",
      expected_delivery_date: transportationDetails.expected_delivery_date || challan.expected_delivery_date || "",
      delivery_date: challan.delivery_date || "",
      delivery_location: challan.delivery_location || "",
      challan_no: challan.challan_no || "",
      challan_date: challan.challan_date || "",
      eway_bill: challan.eway_bill || "",
      remarks: challan.remarks || "",
    });

        // Set items
        if (challan.items && challan.items.length > 0) {
          const formattedItems = challan.items.map(item => ({
            productCode: item.product_code || "",
            imageUrl: item.product_image || "",
            name: item.product_name || "",
            hsn: item.product_hsn || "",
            specification: item.product_specification || "",
            unit: item.product_unit || "",
            quantity: item.product_quantity || 1,
            price: item.product_price || 0,
          }));
          setItems(formattedItems);
        }
      } catch (err) {
        setError(err.message || "Failed to fetch delivery challan");
      } finally {
        setFetchLoading(false);
      }
    };

    if (id) {
      fetchChallan();
    }
  }, [id]);

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
        transporter_name: formData.transporter_name,
        transporter_gstin: formData.transporter_gstin,
        lr_no: formData.lr_no,
        mode: formData.transportation_mode,
        vehicle_no: formData.vehicle_no,
        driver_name: formData.driver_name,
        driver_contact: formData.driver_contact,
        expected_delivery_date: formData.expected_delivery_date,
      });

      const response = await fetch(`/api/admin/delivery-challan/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          delivery_challan_for: formData.delivery_challan_for,
          delivery_challan_for_address: formData.delivery_challan_for_address,
          delivery_challan_for_gstin: formData.delivery_challan_for_gstin,
          ship_to: formData.ship_to,
          ship_to_address: formData.ship_to_address,
          ship_to_gstin: formData.ship_to_gstin,
          transportation_details,
          expected_delivery_date: formData.expected_delivery_date,
          delivery_date: formData.delivery_date,
          delivery_location: formData.delivery_location,
          challan_no: formData.challan_no,
          challan_date: formData.challan_date,
          eway_bill: formData.eway_bill,
          items,
          remarks: formData.remarks,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update delivery challan");
      }

      router.push("/admin-dashboard/delivery-challan");
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg bg-white hover:bg-gray-50 border border-gray-200 shadow-sm transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-700">Edit Delivery Challan</h1>
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
              placeholder="Enter ship to"
            />
          </div>
        </div>

        {/* Addresses & GSTIN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Challan For Address
              </label>
              <textarea
                name="delivery_challan_for_address"
                value={formData.delivery_challan_for_address}
                onChange={handleChange}
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                placeholder="Enter address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Challan For GSTIN
              </label>
              <input
                type="text"
                name="delivery_challan_for_gstin"
                value={formData.delivery_challan_for_gstin}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder="Enter GSTIN"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ship To Address
              </label>
              <textarea
                name="ship_to_address"
                value={formData.ship_to_address}
                onChange={handleChange}
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                placeholder="Enter address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ship To GSTIN
              </label>
              <input
                type="text"
                name="ship_to_gstin"
                value={formData.ship_to_gstin}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder="Enter GSTIN"
              />
            </div>
          </div>
        </div>

        {/* Transportation Details Section */}
        <div className="border border-gray-200 rounded-lg p-4 space-y-4">
          <h3 className="text-lg font-semibold text-gray-700">Transportation Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transporter Name
              </label>
              <input
                type="text"
                name="transporter_name"
                value={formData.transporter_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder="Enter transporter name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transporter GSTIN
              </label>
              <input
                type="text"
                name="transporter_gstin"
                value={formData.transporter_gstin}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder="Enter transporter GSTIN"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mode of Transport
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
                <option value="air">Air</option>
                <option value="sea">Sea</option>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expected Delivery Date
              </label>
              <input
                type="date"
                name="expected_delivery_date"
                value={formData.expected_delivery_date}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                LR/Bilty No.
              </label>
              <input
                type="text"
                name="lr_no"
                value={formData.lr_no}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder="Enter LR/Bilty No."
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                E-way Bill
              </label>
              <input
                type="text"
                name="eway_bill"
                value={formData.eway_bill}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder="Enter E-way bill number"
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
            {loading ? "Updating..." : "Update Delivery Challan"}
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
