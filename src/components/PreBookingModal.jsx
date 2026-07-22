"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function PreBookingModal({ isOpen, onClose, customerId, customerName, onSuccess }) {
  const [formData, setFormData] = useState({
    customer_id: "",
    product_name: "",
    item_code: "",
    quantity: 1,
    expected_date: "",
  });
  
  const [suggestions, setSuggestions] = useState({
    customer_id: [],
    product_name: [],
    item_code: [],
  });
  
  const [showSuggestions, setShowSuggestions] = useState({
    customer_id: false,
    product_name: false,
    item_code: false,
  });
  
  const [selectedSuggestions, setSelectedSuggestions] = useState({
    customer_id: false,
    product_name: false,
    item_code: false,
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  
  const suggestionsRef = useRef({
    customer_id: null,
    product_name: null,
    item_code: null,
  });

  // Update form when modal opens with customerId
  useEffect(() => {
    if (isOpen) {
      setFormData((prev) => ({
        ...prev,
        customer_id: customerId || "",
      }));
      setErrors({});
      setTouched({});
      setSelectedSuggestions({
        customer_id: !!customerId,
        product_name: false,
        item_code: false,
      });
    }
  }, [isOpen, customerId]);

  // Fetch suggestions
  const fetchSuggestions = async (field, value) => {
    if (!value.trim() || value.length < 1) {
      setSuggestions((prev) => ({ ...prev, [field]: [] }));
      return;
    }

    try {
      const apiField = field === "customer_id" ? "customer" : field === "product_name" ? "product" : "itemcode";
      const url = `/api/pre-booking-suggestions?type=${apiField}&search=${encodeURIComponent(value)}`;
      console.log("Fetching suggestions from:", url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log("Suggestions response:", data);

      if (data.success) {
        setSuggestions((prev) => ({ ...prev, [field]: data.suggestions }));
        setShowSuggestions((prev) => ({ ...prev, [field]: data.suggestions.length > 0 }));
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const stringValue = String(value || "");
    
    setFormData((prev) => ({
      ...prev,
      [name]: stringValue,
    }));
    setTouched((prev) => ({ ...prev, [name]: true }));
    
    // Reset selection flag if field is cleared
    if (!stringValue.trim()) {
      setSelectedSuggestions((prev) => ({ ...prev, [name]: false }));
    }
    
    // Fetch suggestions on change
    if (stringValue.trim()) {
      fetchSuggestions(name, stringValue);
    } else {
      setSuggestions((prev) => ({ ...prev, [name]: [] }));
      setShowSuggestions((prev) => ({ ...prev, [name]: false }));
    }
  };

  const handleSelectSuggestion = (field, suggestion) => {
    setFormData((prev) => ({
      ...prev,
      [field]: suggestion.id,
    }));
    setShowSuggestions((prev) => ({ ...prev, [field]: false }));
    setSuggestions((prev) => ({ ...prev, [field]: [] }));
    setSelectedSuggestions((prev) => ({ ...prev, [field]: true }));
  };

  const validateForm = () => {
    const newErrors = {};

    const customerId = String(formData.customer_id || "").trim();
    if (!customerId) {
      newErrors.customer_id = "Customer ID is required";
    }
    if (!selectedSuggestions.customer_id && customerId) {
      newErrors.customer_id = "Please select a customer from suggestions";
    }

    const productName = String(formData.product_name || "").trim();
    if (!productName) {
      newErrors.product_name = "Product name is required";
    }
    if (!selectedSuggestions.product_name && productName) {
      newErrors.product_name = "Please select a product from suggestions";
    }

    const itemCode = String(formData.item_code || "").trim();
    if (!itemCode) {
      newErrors.item_code = "Item code is required";
    }
    if (!selectedSuggestions.item_code && itemCode) {
      newErrors.item_code = "Please select an item code from suggestions";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = () => {
    const customerId = String(formData.customer_id || "").trim();
    const productName = String(formData.product_name || "").trim();
    const itemCode = String(formData.item_code || "").trim();

    return (
      selectedSuggestions.customer_id &&
      customerId &&
      selectedSuggestions.product_name &&
      productName &&
      selectedSuggestions.item_code &&
      itemCode
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill in all required fields correctly");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/pre-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: formData.customer_id,
          product_name: formData.product_name,
          item_code: formData.item_code || null,
          quantity: parseInt(formData.quantity) || 1,
          expected_date: formData.expected_date || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Pre-booking created successfully!");
        setFormData({
          customer_id: "",
          product_name: "",
          item_code: "",
          quantity: 1,
          expected_date: "",
        });
        setErrors({});
        setTouched({});
        setSelectedSuggestions({
          customer_id: false,
          product_name: false,
          item_code: false,
        });
        onClose();
        if (onSuccess) onSuccess();
      } else {
        toast.error(data.error || "Failed to create pre-booking");
      }
    } catch (error) {
      console.error("Error creating pre-booking:", error);
      toast.error("Failed to create pre-booking");
    } finally {
      setLoading(false);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      Object.keys(suggestionsRef.current).forEach((key) => {
        if (suggestionsRef.current[key] && !suggestionsRef.current[key].contains(event.target)) {
          setShowSuggestions((prev) => ({ ...prev, [key]: false }));
        }
      });
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-800">Create Pre-Booking</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Customer ID with Autocomplete */}
          <div ref={(el) => (suggestionsRef.current.customer_id = el)} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="customer_id"
              value={formData.customer_id}
              onChange={handleChange}
              placeholder="Enter customer ID"
              className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 transition-all ${
                errors.customer_id && touched.customer_id
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:ring-blue-500"
              }`}
              disabled={loading}
              autoComplete="off"
            />
            
            {/* Suggestions Dropdown */}
            {showSuggestions.customer_id && suggestions.customer_id.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                {suggestions.customer_id.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSuggestion("customer_id", suggestion)}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{suggestion.id}</div>
                    <div className="text-xs text-gray-600">
                      {suggestion.first_name && <span>{suggestion.first_name}</span>}
                      {suggestion.company && <span>{suggestion.first_name ? " • " : ""}{suggestion.company}</span>}
                      {suggestion.phone && <span> • {suggestion.phone}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {errors.customer_id && touched.customer_id && (
              <div className="flex items-center gap-1 mt-1 text-red-600 text-xs">
                <AlertCircle size={14} />
                {errors.customer_id}
              </div>
            )}
          </div>

          {/* Product Name with Autocomplete */}
          <div ref={(el) => (suggestionsRef.current.product_name = el)} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="product_name"
              value={formData.product_name}
              onChange={handleChange}
              placeholder="Enter product name"
              className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 transition-all ${
                errors.product_name && touched.product_name
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:ring-blue-500"
              }`}
              disabled={loading}
              autoComplete="off"
            />
            
            {/* Suggestions Dropdown */}
            {showSuggestions.product_name && suggestions.product_name.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                {suggestions.product_name.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSuggestion("product_name", suggestion)}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{suggestion.id}</div>
                    {(suggestion.item_code || suggestion.product_number) && (
                      <div className="text-xs text-gray-600">
                        {suggestion.item_code && <span>{suggestion.item_code}</span>}
                        {suggestion.product_number && <span>{suggestion.item_code ? " • " : ""}{suggestion.product_number}</span>}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
            
            {errors.product_name && touched.product_name && (
              <div className="flex items-center gap-1 mt-1 text-red-600 text-xs">
                <AlertCircle size={14} />
                {errors.product_name}
              </div>
            )}
          </div>

          {/* Item Code with Autocomplete */}
          <div ref={(el) => (suggestionsRef.current.item_code = el)} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Item Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="item_code"
              value={formData.item_code}
              onChange={handleChange}
              placeholder="Enter item code (required)"
              className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 transition-all ${
                errors.item_code && touched.item_code
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:ring-blue-500"
              }`}
              disabled={loading}
              autoComplete="off"
            />
            
            {/* Suggestions Dropdown */}
            {showSuggestions.item_code && suggestions.item_code.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                {suggestions.item_code.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSuggestion("item_code", suggestion)}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{suggestion.id}</div>
                    {suggestion.item_name && (
                      <div className="text-xs text-gray-600">{suggestion.item_name}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
            
            {errors.item_code && touched.item_code && (
              <div className="flex items-center gap-1 mt-1 text-red-600 text-xs">
                <AlertCircle size={14} />
                {errors.item_code}
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity
            </label>
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              placeholder="Enter quantity"
              min="1"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          {/* Expected Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expected Delivery Date
            </label>
            <input
              type="date"
              name="expected_date"
              value={formData.expected_date}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isFormValid()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                "Create"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
