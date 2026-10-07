"use client";

import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { CalendarDays } from "lucide-react";

/** Parse typed date (DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD) to ISO date for filters. */
export function parseFlexibleDateToIso(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";

  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
      return dayjs(dt).format("YYYY-MM-DD");
    }
    return null;
  }

  const dmyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmyMatch) {
    const d = Number(dmyMatch[1]);
    const m = Number(dmyMatch[2]);
    let y = Number(dmyMatch[3]);
    if (y < 100) y += 2000;
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
      return dayjs(dt).format("YYYY-MM-DD");
    }
    return null;
  }

  return null;
}

export function formatIsoDateForDisplay(iso) {
  if (!iso) return "";
  const d = dayjs(iso);
  return d.isValid() ? d.format("DD/MM/YYYY") : iso;
}

export default function TypeableDateFilterInput({
  value,
  onChange,
  className = "",
  wrapperClassName = "",
  placeholder = "DD/MM/YYYY",
  showToastOnInvalid = true,
  id,
  disabled,
  min,
  max,
  ...rest
}) {
  const pickerRef = useRef(null);
  const [text, setText] = useState(() => formatIsoDateForDisplay(value));
  const [focused, setFocused] = useState(false);

  const isoValue = value || "";

  useEffect(() => {
    if (!focused) setText(formatIsoDateForDisplay(value));
  }, [value, focused]);

  const applyIso = (iso) => {
    onChange(iso || "");
    setText(iso ? formatIsoDateForDisplay(iso) : "");
  };

  const commit = () => {
    if (disabled) return;
    const trimmed = text.trim();
    if (!trimmed) {
      applyIso("");
      return;
    }
    const iso = parseFlexibleDateToIso(trimmed);
    if (iso) {
      applyIso(iso);
    } else {
      if (showToastOnInvalid) {
        toast.error("Invalid date — use DD/MM/YYYY or YYYY-MM-DD");
      }
      setText(formatIsoDateForDisplay(value));
    }
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el || disabled) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        // fall through
      }
    }
    el.click();
  };

  const handlePickerChange = (e) => {
    const iso = e.target.value;
    applyIso(iso);
    setFocused(false);
  };

  const { type: _ignoredType, onBlur: onBlurProp, ...textRest } = rest;

  const textClassName = [
    className,
    "min-w-0 flex-1 pr-9",
  ]
    .filter(Boolean)
    .join(" ");

  const wrapperClasses = wrapperClassName
    ? wrapperClassName
    : "relative flex w-full min-w-0 items-stretch";

  return (
    <div className={wrapperClasses}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        id={id}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          setFocused(false);
          commit();
          onBlurProp?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        className={textClassName}
        {...textRest}
      />

      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={openPicker}
        className="absolute right-0 top-0 flex h-full w-9 shrink-0 items-center justify-center text-gray-500 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-50"
        aria-label="Open calendar"
        title="Pick date"
      >
        <CalendarDays className="h-4 w-4 pointer-events-none" aria-hidden />
      </button>

      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        value={isoValue}
        min={min}
        max={max}
        onChange={handlePickerChange}
        className="absolute right-0 top-0 h-full w-9 cursor-pointer opacity-0"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
