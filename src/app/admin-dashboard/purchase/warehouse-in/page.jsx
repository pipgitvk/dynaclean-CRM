"use client";

import WarehouseInForm from "@/components/forms/WarehouseInForm";

export default function WarehouseInPage() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Warehouse In - Receive Stock</h1>
        <p className="text-gray-600 mt-1">Process incoming stock and update warehouse inventory</p>
      </div>
      
      <WarehouseInForm />
    </div>
  );
}
