"use client";

import GenerateRequestForm from "@/components/forms/GenerateRequestForm";

export default function GenerateRequestPage() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Generate Purchase Request</h1>
        <p className="text-gray-600 mt-1">Create a new stock purchase request with complete product and logistics details</p>
      </div>
      
      <GenerateRequestForm />
    </div>
  );
}
