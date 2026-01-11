"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UpdateServicePage({ params }) {
  const router = useRouter();
  const serviceId = params.service_id;

  const [companyCost, setCompanyCost] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const res = await fetch("/api/service/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        company_cost: companyCost,
      }),
    });

    const data = await res.json();
    if (data.success) {
      router.push("/user-dashboard/warranty/products");
    } else {
      alert("Failed to update: " + data.message);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-12 p-6 bg-white shadow-md rounded-lg">
      <h1 className="text-2xl font-semibold mb-6">
        Update Company Cost (Service ID: {serviceId})
      </h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="company_cost"
            className="block text-sm font-medium mb-1"
          >
            New Company Cost:
          </label>
          <input
            type="number"
            id="company_cost"
            name="company_cost"
            value={companyCost}
            onChange={(e) => setCompanyCost(e.target.value)}
            required
            className="w-full p-2 border rounded-md shadow-sm"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
        >
          Update Record
        </button>
      </form>
    </div>
  );
}
