"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function TypeFilter({ initialType }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (e) => {
    const newType = e.target.value;
    const params = new URLSearchParams(searchParams);
    
    if (newType) {
      params.set("type", newType);
    } else {
      params.delete("type");
    }
    
    // Reset to page 1 when filter changes
    params.set("page", "1");
    
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="type-filter" className="text-sm font-medium text-gray-700">
        Type:
      </label>
      <select
        id="type-filter"
        value={initialType || ""}
        onChange={handleChange}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      >
        <option value="">All Types</option>
        <option value="product">Products</option>
        <option value="spare">Spares</option>
      </select>
    </div>
  );
}
