"use client";

import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { value: "", label: "All Price Types" },
  { value: "special", label: "Special Price" },
  { value: "dealer", label: "Dealer Price" },
];

export default function PriceTypeFilter({ initialPriceType }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (e) => {
    const value = e.target.value;
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (value) {
      params.set("priceType", value);
    } else {
      params.delete("priceType");
    }
    params.set("page", "1");
    const query = params.toString();
    router.replace(
      query
        ? `/admin-dashboard/special-pricing?${query}`
        : `/admin-dashboard/special-pricing`,
    );
  };

  return (
    <select
      value={initialPriceType || ""}
      onChange={handleChange}
      className="border border-gray-300 rounded px-3 py-2 text-sm w-full sm:w-44 bg-white"
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value || "all"} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
