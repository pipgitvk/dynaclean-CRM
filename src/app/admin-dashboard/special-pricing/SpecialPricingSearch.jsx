 "use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function SpecialPricingSearch({ initialSearch, suggestions }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialSearch || "");

  useEffect(() => {
    setValue(initialSearch || "");
  }, [initialSearch]);

  const options = useMemo(() => {
    const seen = new Set();
    const result = [];
    (suggestions || []).forEach((sugg) => {
      [sugg.customerName, sugg.productName, sugg.productCode].forEach(
        (text) => {
          const normalized = (text || "").trim();
          if (normalized && !seen.has(normalized)) {
            seen.add(normalized);
            result.push(normalized);
          }
        },
      );
    });
    return result;
  }, [suggestions]);

  useEffect(() => {
    const handler = setTimeout(() => {
      const current = searchParams ? searchParams.toString() : "";
      const params = new URLSearchParams(current);

      if (value) {
        params.set("search", value);
        params.set("page", "1");
      } else {
        params.delete("search");
        params.set("page", "1");
      }

      const query = params.toString();
      router.replace(
        query
          ? `/admin-dashboard/special-pricing?${query}`
          : `/admin-dashboard/special-pricing`,
      );
    }, 300);

    return () => clearTimeout(handler);
  }, [value, router, searchParams]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        list="special-price-approvals-search"
        placeholder="Search by customer, product, code or status"
        className="border border-gray-300 rounded px-3 py-2 text-sm w-full sm:w-80"
      />
      <datalist id="special-price-approvals-search">
        {options.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </div>
  );
}

