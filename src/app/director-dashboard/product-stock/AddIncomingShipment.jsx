"use client";

import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import { useState } from "react";
import { X } from "lucide-react";
import SearchableSelect from "./SearchableSelect";

export default function AddIncomingShipment({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
  products = []
}) {
  const [formData, setFormData] = useState({
    product_code: "",
    item_name: "",
    qty: "",
    supplier_name: "",
    transporter_name: "",
    expected_arrival_date: "",
    status: "Order Preparing",
    notes: ""
  });

  const [errors, setErrors] = useState({});

  const statusOptions = [
    "Order Preparing",
    "Paid",
    "Sailed",
    "Arrived at Port",
    "Rail Out",
    "Delivered"
  ];

  // Convert products to options format for SearchableSelect
  const productOptions = products
    .filter(product => product && (product.product_code || product.item_code))
    .map(product => {
      const productCode = product.product_code || product.item_code || "";
      const productName = product.item_name || product.product_name || product.name || "Unknown";
      
      console.log("Product mapping:", { productCode, productName, fullProduct: product });
      
      return {
        value: productCode,
        label: `${productCode} - ${productName}`,
        item_name: productName
      };
    });

  const validateForm = () => {
    const newErrors = {};

    if (!formData.supplier_name.trim()) {
      newErrors.supplier_name = "Supplier name is required";
    }

    if (!formData.qty || parseInt(formData.qty) <= 0) {
      newErrors.qty = "Quantity must be a positive number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  // Handle product selection from SearchableSelect
  const handleProductChange = (selectedValue) => {
    const selectedProduct = products.find(p => 
      (p.product_code && p.product_code === selectedValue) || 
      (p.item_code && p.item_code === selectedValue)
    );
    
    const itemName = selectedProduct ? 
      (selectedProduct.item_name || selectedProduct.product_name || selectedProduct.name || selectedValue) : 
      "";
    
    console.log("Selected product:", selectedProduct);
    console.log("Setting item_name to:", itemName);
    
    setFormData(prev => ({
      ...prev,
      product_code: selectedValue,
      item_name: itemName
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    await onSubmit(formData);

    // Reset form
    setFormData({
      product_code: "",
      item_name: "",
      qty: "",
      supplier_name: "",
      transporter_name: "",
      expected_arrival_date: "",
      status: "Order Preparing",
      notes: ""
    });
    setErrors({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-gray-200 bg-white">
          <h2 className="text-xl font-semibold text-gray-800">Add New Incoming Shipment</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            disabled={loading}
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Product Selection Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product Code - Searchable */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Code
              </label>
              <SearchableSelect
                options={productOptions}
                value={formData.product_code}
                onChange={handleProductChange}
                placeholder="Search & Select Product (Optional)"
                displayKey="label"
                valueKey="value"
              />
            </div>

            {/* Item Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item Name / Description
              </label>
              <input
                type="text"
                name="item_name"
                value={formData.item_name}
                onChange={handleChange}
                placeholder="e.g., DSC-30, Pump Assembly"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Quantity Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="qty"
                value={formData.qty}
                onChange={handleChange}
                placeholder="Enter quantity"
                min="1"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.qty ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.qty && <p className="text-red-500 text-sm mt-1">{errors.qty}</p>}
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {statusOptions.map(status => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Supplier Row */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supplier Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="supplier_name"
              value={formData.supplier_name}
              onChange={handleChange}
              placeholder="e.g., ABC Supplies, XYZ Company"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.supplier_name ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.supplier_name && (
              <p className="text-red-500 text-sm mt-1">{errors.supplier_name}</p>
            )}
          </div>

          {/* Transporter Row */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transporter Name
            </label>
            <input
              type="text"
              name="transporter_name"
              value={formData.transporter_name}
              onChange={handleChange}
              placeholder="e.g., DHL, FedEx, Local Courier"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Expected Arrival Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expected Arrival Date
            </label>
            <TypeableDateFilterInput value={formData.expected_arrival_date} onChange={(v) => handleChange({ target: { name: "expected_arrival_date", value: v } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes / Additional Info
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any additional notes..."
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Shipment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

