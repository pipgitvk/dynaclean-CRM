"use client";

import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { CRM_DATE_FORMAT } from "@/lib/crmDateFormat";
import toast from "react-hot-toast";
import { CalendarDays } from "lucide-react";

/** Parse typed date (DD-MM-YYYY, DD-MM-YYYY, or YYYY-MM-DD) to ISO date for filters. */
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
  return d.isValid() ? d.format(CRM_DATE_FORMAT) : iso;
}

export default function TypeableDateFilterInput({
  value,
  onChange,
  className = "",
  wrapperClassName = "",
  placeholder = "DD-MM-YYYY",
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
        toast.error("Invalid date — use DD-MM-YYYY or YYYY-MM-DD");
      }
      setText(formatIsoDateForDisplay(value));
    }
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
    : "relative flex w-auto min-w-[9.5rem] max-w-full shrink-0 items-stretch";

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

      {/* Native date control over the icon — browser opens picker on click (reliable vs showPicker on hidden input). */}
      <div className="absolute right-0 top-0 z-10 h-full w-9 shrink-0">
        <input
          ref={pickerRef}
          type="date"
          disabled={disabled}
          value={isoValue}
          min={min}
          max={max}
          onChange={handlePickerChange}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
          title="Pick date"
          aria-label="Pick date"
        />
        <div
          className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center text-gray-500"
          aria-hidden
        >
          <CalendarDays className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
