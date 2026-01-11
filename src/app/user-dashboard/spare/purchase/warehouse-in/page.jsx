"use client";

import SpareWarehouseInForm from "@/components/forms/SpareWarehouseInForm";

export default function SpareWarehouseInPage() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Spare Warehouse In - Receive Stock</h1>
        <p className="text-gray-600 mt-1">Process incoming spare stock and update warehouse inventory</p>
      </div>

      <SpareWarehouseInForm />
    </div>
  );
}
