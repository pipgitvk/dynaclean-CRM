"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function displayName(customer) {
  const built = String(customer?.customer_name || "").trim();
  if (built) return built;
  return `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim();
}

/**
 * Search customers table by ID, name, company, phone — fills party payment fields on pick.
 */
export default function CustomerIdSearchField({
  label = "Customer ID",
  customerId = "",
  onCustomerIdChange,
  onCustomerSelect,
  required = false,
  placeholder = "Search by customer ID, name, company, phone…",
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [query, setQuery] = useState("");
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    setQuery(customerId ? String(customerId) : "");
  }, [customerId]);

  const fetchSuggestions = useCallback(async (q) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/customers/search?q=${encodeURIComponent(q)}&limit=12`,
        { credentials: "include" },
      );
      const json = await res.json();
      const list = json?.success && Array.isArray(json.data) ? json.data : [];
      setSuggestions(list);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (e) => {
    const next = e.target.value;
    setQuery(next);
    onCustomerIdChange?.(next.trim());
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(next), 280);
  };

  const pick = (customer) => {
    const id = String(customer.customer_id ?? "").trim();
    const name = displayName(customer);
    setQuery(id || name);
    onCustomerIdChange?.(id);
    onCustomerSelect?.(customer);
    setOpen(false);
    setSuggestions([]);
  };

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required ? " *" : ""}
      </label>
      <input
        type="text"
        value={query}
        required={required}
        autoComplete="off"
        placeholder={placeholder}
        onChange={handleInput}
        onFocus={() => {
          setOpen(true);
          fetchSuggestions(query);
        }}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <p className="mt-1 text-xs text-gray-500">
        Pick from customers list — name, company and phone will auto-fill.
      </p>

      {open && (loading || suggestions.length > 0) && (
        <ul
          className="absolute z-[60] mt-1 w-full max-h-52 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg text-sm"
          role="listbox"
        >
          {loading ? (
            <li className="px-3 py-2 text-gray-500">Searching…</li>
          ) : (
            suggestions.map((customer) => {
              const name = displayName(customer);
              return (
                <li key={customer.customer_id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(customer)}
                  >
                    <div className="font-medium text-gray-900">
                      #{customer.customer_id}
                      {name ? ` — ${name}` : ""}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {customer.company ? `${customer.company} · ` : ""}
                      {customer.phone || "—"}
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
