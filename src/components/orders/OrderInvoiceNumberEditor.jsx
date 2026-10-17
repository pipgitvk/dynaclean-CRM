"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

export default function OrderInvoiceNumberEditor({
  orderId,
  initialValue = "",
}) {
  const [value, setValue] = useState(String(initialValue || "").trim());
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    setValue(String(initialValue || "").trim());
  }, [initialValue]);

  const fetchSuggestions = useCallback(async (q) => {
    const term = String(q || "").trim();
    if (term.length < 1) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/invoice-list?search=${encodeURIComponent(term)}&limit=12`,
        { credentials: "include" },
      );
      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : [];
      const numbers = list
        .map((row) => String(row.invoice_number || "").trim())
        .filter(Boolean);
      const unique = [...new Set(numbers)];
      setSuggestions(unique);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onInputChange = (e) => {
    const next = e.target.value;
    setValue(next);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(next);
    }, 280);
  };

  const pickSuggestion = (num) => {
    setValue(num);
    setOpen(false);
    setSuggestions([]);
  };

  const save = async () => {
    const trimmed = String(value || "").trim();
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/invoice-number`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_number: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Save failed");
      }
      setValue(String(data.invoice_number || trimmed));
      toast.success("Invoice number saved");
      setOpen(false);
    } catch (err) {
      toast.error(err.message || "Could not save invoice number");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          type="text"
          value={value}
          onChange={onInputChange}
          onFocus={() => {
            setOpen(true);
            if (value.trim()) fetchSuggestions(value);
          }}
          placeholder="Search or type invoice number"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="shrink-0 px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {open && (loading || suggestions.length > 0) && (
        <ul
          className="absolute z-30 mt-1 w-full max-h-48 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg text-sm"
          role="listbox"
        >
          {loading ? (
            <li className="px-3 py-2 text-gray-500">Searching…</li>
          ) : (
            suggestions.map((num) => (
              <li key={num}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-gray-800"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(num)}
                >
                  {num}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
