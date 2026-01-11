"use client";

import SpareGenerateRequestForm from "@/components/forms/SpareGenerateRequestForm";

export default function SpareGenerateRequestPage() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Generate Spare Purchase Request</h1>
        <p className="text-gray-600 mt-1">Create a new spare stock purchase request with complete details</p>
      </div>
      
      <SpareGenerateRequestForm />
    </div>
  );
}
