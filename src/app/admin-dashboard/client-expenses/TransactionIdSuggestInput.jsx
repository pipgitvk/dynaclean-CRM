"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Suggests `statements.trans_id` values (unsettled first when query empty).
 */
export default function TransactionIdSuggestInput({
  value,
  onChange,
  onBlur,
  name,
  inputRef,
  id,
  className = "",
  placeholder,
  error,
  disabled,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  const fetchList = useCallback((q) => {
    fetch(`/api/statements/trans-id-suggestions?q=${encodeURIComponent(q)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSuggestions(Array.isArray(d.transIds) ? d.transIds : []))
      .catch(() => setSuggestions([]));
  }, []);

  const scheduleFetch = useCallback(
    (q) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchList(q), 260);
    },
    [fetchList]
  );

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  useEffect(() => {
    const onDoc = (ev) => {
      if (!containerRef.current?.contains(ev.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const handleFocus = () => {
    setOpen(true);
    fetchList(String(value || "").trim());
  };

  const handleChange = (e) => {
    const v = e.target.value;
    onChange(v);
    setOpen(true);
    scheduleFetch(v.trim());
  };

  const handleBlur = (e) => {
    onBlur?.(e);
    setTimeout(() => setOpen(false), 120);
  };

  const pick = (t) => {
    onChange(t);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        name={name}
        value={value ?? ""}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        autoComplete="off"
        className={className}
        placeholder={placeholder}
      />
      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-30 mt-1 w-full max-h-52 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg text-sm"
          role="listbox"
        >
          {suggestions.map((t) => (
            <li key={t} role="option">
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-blue-50 text-gray-800 font-mono text-xs sm:text-sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(t)}
              >
                {t}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error?.message && <p className="text-xs text-red-600 mt-1">{error.message}</p>}
    </div>
  );
}
