"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";

/**
 * Searchable dropdown select (menu portals to document.body to avoid overflow clipping).
 * @param {Object} props
 * @param {Array<{value: string, label: string}>} props.options - Options to show
 * @param {string} props.value - Current value
 * @param {function} props.onChange - (value) => void
 * @param {string} [props.placeholder] - Placeholder when nothing selected
 * @param {string} [props.className] - Extra classes for the trigger
 * @param {string} [props.searchPlaceholder] - Placeholder for search input
 */
export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "Select...",
  className = "",
  searchPlaceholder = "Search...",
  onOpen,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuRect, setMenuRect] = useState(null);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const selectedLabel =
    options.find((o) => o.value === value)?.label ?? placeholder;

  const filtered =
    !search.trim()
      ? options
      : options.filter((o) =>
          o.label.toLowerCase().includes(search.toLowerCase().trim()),
        );

  const positionMenu = (optionCount = filtered.length) => {
    const trigger = triggerRef.current;
    if (!trigger) return null;

    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const estimatedMenuHeight = Math.min(280, 56 + optionCount * 36);
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const upward = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
    const nextRect = {
      left: rect.left,
      width: Math.max(rect.width, 200),
      top: upward ? rect.top - gap : rect.bottom + gap,
    };
    setOpenUpward(upward);
    setMenuRect(nextRect);
    return nextRect;
  };

  const updateMenuPosition = () => {
    positionMenu();
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onReflow = () => updateMenuPosition();
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, filtered.length]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const target = e.target;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const menu =
    open && menuRect && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden"
            style={{
              left: menuRect.left,
              width: menuRect.width,
              ...(openUpward
                ? { bottom: window.innerHeight - menuRect.top }
                : { top: menuRect.top }),
            }}
          >
            <div className="border-b border-gray-100 p-2">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded border border-gray-200 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
              ) : (
                filtered.map((opt, idx) => (
                  <button
                    key={`${opt.value}::${idx}`}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm transition hover:bg-blue-50 ${
                      opt.value === value
                        ? "bg-blue-50 font-medium text-blue-700"
                        : "text-gray-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (open) {
            setOpen(false);
            return;
          }
          positionMenu(options.length);
          setOpen(true);
          onOpen?.();
        }}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm transition hover:border-gray-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 ${className}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-disabled={disabled}
      >
        <span
          className={`min-w-0 flex-1 truncate text-left ${value ? "text-gray-900" : "text-gray-500"}`}
        >
          {selectedLabel}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {menu}
    </div>
  );
}