"use client";

import { useState } from "react";
import { X, FileText } from "lucide-react";
import InvoiceForm from "./submit-form";

export default function InvoiceTypeSelector({ invoiceNumber, invoiceDate }) {
  const [invoiceType, setInvoiceType] = useState(null); // null, 'tax', or 'performa'

  if (invoiceType) {
    return (
      <InvoiceForm
        invoiceNumber={invoiceNumber}
        invoiceDate={invoiceDate}
        invoiceType={invoiceType}
        onBack={() => setInvoiceType(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Select Invoice Type</h2>
          <button
            onClick={() => window.history.back()}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} className="text-gray-600" />
          </button>
        </div>

        <p className="text-gray-600 text-sm mb-8">
          Choose the type of invoice you want to create:
        </p>

        <div className="space-y-4">
          {/* Tax Invoice Button */}
          <button
            onClick={() => setInvoiceType("tax")}
            className="w-full flex items-center gap-4 p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 group"
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200">
              <FileText size={24} className="text-blue-600" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-800 text-lg">Tax Invoice</h3>
              <p className="text-gray-600 text-sm">
                Standard tax invoice for business transactions
              </p>
            </div>
          </button>

          {/* Performa Invoice Button */}
          <button
            onClick={() => setInvoiceType("performa")}
            className="w-full flex items-center gap-4 p-6 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 group"
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200">
              <FileText size={24} className="text-purple-600" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-800 text-lg">Performa Invoice</h3>
              <p className="text-gray-600 text-sm">
                Preliminary invoice before formal billing
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
