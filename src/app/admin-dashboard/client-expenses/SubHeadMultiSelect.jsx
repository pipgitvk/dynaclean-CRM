"use client";

import { useState, useEffect, useRef, useMemo } from "react";

/** One-line trigger like a native select; panel opens for multi-select. */
export default function SubHeadMultiSelect({ options, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  const searchRef = useRef(null);

  const list = useMemo(() => (Array.isArray(options) ? options : []), [options]);
  const normalizedSelection = Array.isArray(value) ? value : [];
  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const query = search.trim().toLowerCase();
    return list.filter((opt) => String(opt || "").toLowerCase().includes(query));
  }, [list, search]);

  useEffect(() => {
    const fn = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    if (searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  const label =
    normalizedSelection.length === 0
      ? "Select sub-head"
      : normalizedSelection.length === 1
        ? normalizedSelection[0]
        : `${normalizedSelection.length} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="w-full border p-2 rounded-md text-left flex justify-between items-center gap-2 bg-white disabled:opacity-60 disabled:cursor-not-allowed min-h-[2.5rem]"
      >
        <span
          className={`truncate flex-1 min-w-0 ${normalizedSelection.length ? "text-gray-900" : "text-gray-500"}`}
          title={
            normalizedSelection.length > 1
              ? normalizedSelection.join(", ")
              : normalizedSelection[0] || ""
          }
        >
          {label}
        </span>
        <span className="text-gray-400 text-xs shrink-0">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full border rounded-md bg-white shadow-lg">
          {list.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">No sub-categories configured</p>
          ) : (
            <>
              <div className="p-2 border-b border-gray-200 bg-gray-50">
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search sub-heads..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="max-h-52 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-500">No matches found</p>
                ) : (
                  filtered.map((h) => (
                    <label
                      key={h}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-blue-600 shrink-0"
                        checked={normalizedSelection.includes(h)}
                        onChange={() => {
                          const next = normalizedSelection.includes(h)
                            ? normalizedSelection.filter((x) => x !== h)
                            : [...normalizedSelection, h];
                          onChange(next);
                        }}
                      />
                      <span>{h}</span>
                    </label>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
