"use client";

import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { value: "", label: "All Status" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "pending", label: "Pending" },
];

export default function StatusFilter({ initialStatus }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (e) => {
    const value = e.target.value;
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (value) {
      params.set("status", value);
    } else {
      params.delete("status");
    }
    params.set("page", "1");
    const query = params.toString();
    router.replace(
      query
        ? `/admin-dashboard/special-pricing?${query}`
        : `/admin-dashboard/special-pricing`
    );
  };

  return (
    <select
      value={initialStatus || ""}
      onChange={handleChange}
      className="border border-gray-300 rounded px-3 py-2 text-sm w-full sm:w-40 bg-white"
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value || "all"} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
