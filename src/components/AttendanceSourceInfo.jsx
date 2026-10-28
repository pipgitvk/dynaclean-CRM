"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { isMeaningfulAttendancePunch } from "@/lib/attendanceMeaningfulPunch";
import { formatAttendanceTimeForDisplay as formatTime } from "@/lib/istDateTime";
import {
  MACHINE_ATTENDANCE_ADDRESS,
  getAttendanceSourcesDetailFromLog,
} from "@/lib/attendanceMachineMerge";

function isMachineAttendanceAddress(address) {
  return (
    String(address || "").trim().toLowerCase() ===
    MACHINE_ATTENDANCE_ADDRESS.toLowerCase()
  );
}

export function getAttendanceSourcesDetail(log) {
  return getAttendanceSourcesDetailFromLog(log);
}

export function logHasMachineAttendanceData(log) {
  if (!log) return false;
  if (isMachineAttendanceAddress(log.checkout_address)) return true;
  if (isMachineAttendanceAddress(log.checkin_address)) return true;
  if (
    log.merge_sources?.checkin === "machine" ||
    log.merge_sources?.checkout === "machine"
  ) {
    return true;
  }
  const detail = getAttendanceSourcesDetail(log);
  if (!detail) return false;
  return (
    isMeaningfulAttendancePunch(detail.machine?.checkin) ||
    isMeaningfulAttendancePunch(detail.machine?.checkout)
  );
}

function formatSourceTime(value) {
  return isMeaningfulAttendancePunch(value) ? formatTime(value) : "—";
}

function TooltipPanel({ detail, log }) {
  return (
    <div className="w-56 rounded-md bg-gray-900 px-3 py-2 text-left text-xs text-white shadow-xl ring-1 ring-black/10">
      <p className="mb-1.5 font-semibold text-gray-200">CRM vs machine</p>
      <p>
        <span className="text-gray-400">CRM check-in:</span>{" "}
        {formatSourceTime(detail.crm?.checkin)}
      </p>
      <p>
        <span className="text-gray-400">CRM check-out:</span>{" "}
        {formatSourceTime(detail.crm?.checkout)}
      </p>
      <p className="mt-1.5 border-t border-gray-700 pt-1.5">
        <span className="text-gray-400">Machine check-in:</span>{" "}
        {formatSourceTime(detail.machine?.checkin)}
      </p>
      <p>
        <span className="text-gray-400">Machine check-out:</span>{" "}
        {formatSourceTime(detail.machine?.checkout)}
      </p>
      <p className="mt-1.5 border-t border-gray-700 pt-1.5 text-[10px] text-gray-400">
        Shown in table: in {formatTime(log.checkin_time) || "—"} · out{" "}
        {formatTime(log.checkout_time) || "—"}
      </p>
    </div>
  );
}

/**
 * Info icon — hover shows CRM vs machine check-in and check-out (portal, not clipped by tables).
 */
export default function AttendanceSourceInfo({
  log,
  showOnlyIfMachine = true,
}) {
  const anchorRef = useRef(null);
  const hideTimer = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const detail = getAttendanceSourcesDetail(log);
  const visible =
    !!detail && (!showOnlyIfMachine || logHasMachineAttendanceData(log));

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const panelW = 224;
    const panelH = 168;
    const gap = 8;
    let top = rect.bottom + gap;
    let left = rect.left + rect.width / 2 - panelW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - panelW - 8));
    if (top + panelH > window.innerHeight - 8) {
      top = rect.top - panelH - gap;
    }
    if (top < 8) top = 8;
    setCoords({ top, left });
  }, []);

  if (!visible) return null;

  const titleText = [
    `CRM in: ${formatSourceTime(detail.crm?.checkin)}`,
    `CRM out: ${formatSourceTime(detail.crm?.checkout)}`,
    `Machine in: ${formatSourceTime(detail.machine?.checkin)}`,
    `Machine out: ${formatSourceTime(detail.machine?.checkout)}`,
  ].join(" · ");

  const showTip = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    updatePosition();
    setOpen(true);
  };

  const scheduleHide = () => {
    hideTimer.current = setTimeout(() => setOpen(false), 120);
  };

  const cancelHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="relative ml-0.5 inline-flex shrink-0 align-middle rounded p-0.5 text-indigo-600 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        title={titleText}
        aria-label="CRM and machine attendance details"
        aria-expanded={open}
        onMouseEnter={showTip}
        onMouseLeave={scheduleHide}
        onFocus={showTip}
        onBlur={scheduleHide}
      >
        <Info className="h-4 w-4" aria-hidden />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[10000]"
            style={{ top: coords.top, left: coords.left }}
            onMouseEnter={cancelHide}
            onMouseLeave={scheduleHide}
            role="tooltip"
          >
            <TooltipPanel detail={detail} log={log} />
          </div>,
          document.body,
        )}
    </>
  );
}
