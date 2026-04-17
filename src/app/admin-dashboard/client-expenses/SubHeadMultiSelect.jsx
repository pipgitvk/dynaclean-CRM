"use client";

import { useState, useEffect, useRef } from "react";

/** One-line trigger like a native select; panel opens for multi-select. */
export default function SubHeadMultiSelect({ options, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const fn = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const selected = Array.isArray(value) ? value : [];
  const label =
    selected.length === 0
      ? "Select sub-head"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="w-full border p-2 rounded-md text-left flex justify-between items-center gap-2 bg-white disabled:opacity-60 disabled:cursor-not-allowed min-h-[2.5rem]"
      >
        <span
          className={`truncate flex-1 min-w-0 ${selected.length ? "text-gray-900" : "text-gray-500"}`}
          title={selected.length > 1 ? selected.join(", ") : selected[0] || ""}
        >
          {label}
        </span>
        <span className="text-gray-400 text-xs shrink-0">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full border rounded-md bg-white shadow-lg max-h-48 overflow-y-auto py-1">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">No sub-categories configured</p>
          ) : (
            options.map((h) => (
              <label
                key={h}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-blue-600 shrink-0"
                  checked={selected.includes(h)}
                  onChange={() => {
                    const next = selected.includes(h)
                      ? selected.filter((x) => x !== h)
                      : [...selected, h];
                    onChange(next);
                  }}
                />
                <span>{h}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
