"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Edit2, Save, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";

export default function TermsConditionsModal({ 
  isOpen, 
  onClose, 
  onSave,
}) {
  const [savedTerms, setSavedTerms] = useState([]);
  const [selectedTermId, setSelectedTermId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(true); // Default true to show form

  // Form state
  const [title, setTitle] = useState("");
  const [terms, setTerms] = useState("");
  const [applicable, setApplicable] = useState({
    saleInvoice: false,
    saleOrder: false,
    deliveryChallan: false,
    estimationQuotation: false,
    purchaseBill: true,
    purchaseOrder: false,
    proformaInvoice: false
  });

  // Fetch saved terms on modal open
  useEffect(() => {
    if (isOpen) {
      fetchSavedTerms();
    }
  }, [isOpen]);

  const fetchSavedTerms = async () => {
    try {
      setLoading(true);
      console.log("Fetching saved terms...");
      const response = await fetch("/api/terms-conditions", {
        credentials: "include"
      });
      console.log("Response status:", response.status);
      const result = await response.json();
      console.log("Result:", result);
      
      if (result.success) {
        console.log("Saved terms:", result.data);
        setSavedTerms(result.data);
      } else {
        console.error("API returned error:", result.error);
        toast.error(result.error || "Failed to load saved terms");
      }
    } catch (error) {
      console.error("Error fetching terms:", error);
      toast.error("Failed to load saved terms");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setTerms("");
    setApplicable({
      saleInvoice: false,
      saleOrder: false,
      deliveryChallan: false,
      estimationQuotation: false,
      purchaseBill: true,
      purchaseOrder: false,
      proformaInvoice: false
    });
    setIsEditing(false);
  };

  const handleSelectTerm = (termId) => {
    const term = savedTerms.find(t => t.id === termId);
    if (term) {
      setSelectedTermId(termId);
      setTitle(term.title);
      setTerms(term.terms_text);
      setApplicable(JSON.parse(term.applicable_for || "{}"));
      setIsEditing(true); // Direct edit mode
    }
  };

  const handleAddNew = () => {
    resetForm();
    setSelectedTermId(null);
    setIsEditing(true);
  };

  const handleEditCurrent = () => {
    setIsEditing(true);
  };

  const handleSaveForm = async () => {
    if (!title.trim() || !terms.trim()) {
      toast.error("Title and terms are required");
      return;
    }

    try {
      const method = selectedTermId ? "PUT" : "POST";
      const url = "/api/terms-conditions";

      const payload = {
        ...(selectedTermId && { id: selectedTermId }),
        title,
        terms,
        applicable
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        toast.success(selectedTermId ? "Terms updated successfully" : "Terms added successfully");
        fetchSavedTerms();
        
        if (!selectedTermId) {
          // Auto-select newly created term
          setSelectedTermId(result.data.id);
        }
        
        setIsEditing(false);
      } else {
        toast.error(result.error || "Failed to save terms");
      }
    } catch (error) {
      console.error("Error saving terms:", error);
      toast.error("Error saving terms");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this terms and conditions?")) {
      return;
    }

    try {
      const response = await fetch(`/api/terms-conditions?id=${id}`, {
        method: "DELETE",
        credentials: "include"
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Terms deleted successfully");
        fetchSavedTerms();
        if (selectedTermId === id) {
          setSelectedTermId(null);
          resetForm();
        }
      } else {
        toast.error(result.error || "Failed to delete terms");
      }
    } catch (error) {
      console.error("Error deleting terms:", error);
      toast.error("Error deleting terms");
    }
  };

  const handleApply = () => {
    const selected = savedTerms.find(t => t.id === selectedTermId);
    if (selected) {
      onSave(selected);
      onClose();
    } else {
      toast.error("Please select a terms and conditions");
    }
  };

  const getSelectedTerm = () => {
    return savedTerms.find(t => t.id === selectedTermId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-transparent flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Terms & Conditions</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Dropdown to select or add new */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select or Create Terms & Conditions
              </label>
              <div className="relative">
                <select
                  value={selectedTermId || "add-new"}
                  onChange={(e) => {
                    console.log("Dropdown changed:", e.target.value);
                    if (e.target.value === "add-new") {
                      handleAddNew();
                    } else {
                      handleSelectTerm(Number(e.target.value));
                    }
                  }}
                  className="w-full appearance-none border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="add-new">+ Add New Terms & Conditions</option>
                  {console.log("Rendering dropdown options, savedTerms:", savedTerms)}
                  {savedTerms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.title}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {/* Display selected or form */}
            {selectedTermId && !isEditing && getSelectedTerm() ? (
              // Display Card
              <div className="border border-gray-300 rounded-lg p-6 bg-gradient-to-br from-gray-50 to-white">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
                    <p className="text-xs text-gray-500 mt-1">Click edit to modify this terms and conditions</p>
                  </div>
                  <button
                    onClick={handleEditCurrent}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                </div>

                {/* Terms Text */}
                <div className="mb-4 p-4 bg-white border border-gray-200 rounded">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{terms}</p>
                </div>

                {/* Applicable For */}
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Applicable for:</h4>
                  <div className="flex flex-wrap gap-2">
                    {applicable.saleInvoice && (
                      <span className="px-2.5 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Sale Invoice</span>
                    )}
                    {applicable.saleOrder && (
                      <span className="px-2.5 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Sale Order</span>
                    )}
                    {applicable.deliveryChallan && (
                      <span className="px-2.5 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Delivery Challan</span>
                    )}
                    {applicable.estimationQuotation && (
                      <span className="px-2.5 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Estimation/Quotation</span>
                    )}
                    {applicable.purchaseBill && (
                      <span className="px-2.5 py-1 text-xs bg-green-100 text-green-800 rounded-full font-medium">Purchase Bill</span>
                    )}
                    {applicable.purchaseOrder && (
                      <span className="px-2.5 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Purchase Order</span>
                    )}
                    {applicable.proformaInvoice && (
                      <span className="px-2.5 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Proforma Invoice</span>
                    )}
                  </div>
                </div>

                {/* Delete Button */}
                <div className="flex justify-end">
                  <button
                    onClick={() => handleDelete(selectedTermId)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            ) : isEditing ? (
              // Edit/Create Form
              <div className="border border-gray-300 rounded-lg p-6 bg-gradient-to-br from-gray-50 to-white space-y-4">
                {/* Title Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter terms title..."
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Terms Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Terms & Conditions *
                  </label>
                  <textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    placeholder="Enter your terms and conditions text here..."
                    rows={6}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Applicable For */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Applicable for:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "saleInvoice", label: "Sale Invoice" },
                      { key: "saleOrder", label: "Sale Order" },
                      { key: "deliveryChallan", label: "Delivery Challan" },
                      { key: "estimationQuotation", label: "Estimation/Quotation" },
                      { key: "purchaseBill", label: "Purchase Bill" },
                      { key: "purchaseOrder", label: "Purchase Order" },
                      { key: "proformaInvoice", label: "Proforma Invoice" }
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={applicable[key]}
                          onChange={(e) => setApplicable(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleSaveForm}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  >
                    <Save size={16} />
                    {selectedTermId ? "Update" : "Save"} Terms
                  </button>
                  <button
                    onClick={() => {
                      if (selectedTermId) {
                        handleSelectTerm(selectedTermId);
                      } else {
                        resetForm();
                        setSelectedTermId(null);
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // Empty State
              <div className="border border-dashed border-gray-300 rounded-lg p-12 text-center">
                <p className="text-gray-500 text-sm mb-2">No terms & conditions selected</p>
                <p className="text-gray-400 text-xs">Choose from dropdown or create a new one</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!selectedTermId || isEditing || loading}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply Selected Terms
          </button>
        </div>
      </div>
    </div>
  );
}