"use client";

import WarehouseInReceiveForm from "@/components/forms/WarehouseInReceiveForm";

export default function WarehouseInReceivePage() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          Warehouse In — Receive Stock
        </h1>
        <p className="text-gray-600 mt-1">
          Select product, then enter receipt details and supporting documents
        </p>
      </div>
      <WarehouseInReceiveForm />
    </div>
  );
}
