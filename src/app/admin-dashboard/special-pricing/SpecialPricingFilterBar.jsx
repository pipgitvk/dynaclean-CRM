"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function SpecialPricingFilterBar({
  initialSearch,
  initialStatus,
  initialType,
  initialPriceType,
  suggestions,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(initialSearch || "");
  const [status, setStatus] = useState(initialStatus || "");
  const [type, setType] = useState(initialType || "");
  const [priceType, setPriceType] = useState(initialPriceType || "");

  useEffect(() => {
    setSearch(initialSearch || "");
    setStatus(initialStatus || "");
    setType(initialType || "");
    setPriceType(initialPriceType || "");
  }, [initialSearch, initialStatus, initialType, initialPriceType]);

  const options = useMemo(() => {
    const seen = new Set();
    const result = [];
    (suggestions || []).forEach((sugg) => {
      [
        sugg.customerName,
        sugg.productName,
        sugg.productCode,
        sugg.priceType,
        sugg.status,
      ].forEach((text) => {
        const normalized = (text || "").trim();
        if (normalized && !seen.has(normalized)) {
          seen.add(normalized);
          result.push(normalized);
        }
      });
    });
    return result;
  }, [suggestions]);

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    const q = search.trim();
    if (q) params.set("search", q);
    else params.delete("search");
    if (status) params.set("status", status);
    else params.delete("status");
    if (type) params.set("type", type);
    else params.delete("type");
    if (priceType) params.set("priceType", priceType);
    else params.delete("priceType");
    params.set("page", "1");
    const query = params.toString();
    router.replace(
      query
        ? `/admin-dashboard/special-pricing?${query}`
        : `/admin-dashboard/special-pricing`,
    );
  };

  return (
    <div className="flex flex-col gap-2 w-full min-w-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 lg:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyFilters();
            }
          }}
          list="special-price-approvals-search"
          placeholder="Search customer, product, code…"
          className="border border-gray-300 rounded px-3 py-2 text-sm w-full min-w-0 sm:col-span-2 lg:col-span-2"
        />
        <datalist id="special-price-approvals-search">
          {options.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-full min-w-0 bg-white"
        >
          <option value="">All Status</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="pending">Pending</option>
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-full min-w-0 bg-white"
        >
          <option value="">All Types</option>
          <option value="product">Products</option>
          <option value="spare">Spares</option>
        </select>
        <select
          value={priceType}
          onChange={(e) => setPriceType(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-full min-w-0 bg-white"
        >
          <option value="">All Price Types</option>
          <option value="special">Special Price</option>
          <option value="dealer">Dealer Price</option>
        </select>
        <button
          type="button"
          onClick={applyFilters}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md sm:col-span-2 lg:col-span-1"
        >
          Search
        </button>
      </div>
      <p className="text-xs text-gray-500">Set filters, then click Search to update results.</p>
    </div>
  );
}
