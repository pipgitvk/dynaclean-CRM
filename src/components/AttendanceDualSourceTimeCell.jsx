"use client";

import { isMeaningfulAttendancePunch } from "@/lib/attendanceMeaningfulPunch";
import { formatAttendanceTimeForDisplay as formatTime } from "@/lib/istDateTime";
import {
  getLogsTableTimes,
  getMachinePunchTimes,
  shouldShowLogAndMachineSourceLines,
} from "@/lib/attendanceMachineMerge";
import AttendanceSourceInfo from "@/components/AttendanceSourceInfo";

function formatPunch(value) {
  return isMeaningfulAttendancePunch(value) ? formatTime(value) : "—";
}

/**
 * Shows attendance_logs and machine_attendance_punches times separately when both apply.
 * `field`: "checkin" | "checkout"
 */
export default function AttendanceDualSourceTimeCell({
  log,
  field,
  mergedFallback,
  checkoutExtra = null,
}) {
  const showDual = shouldShowLogAndMachineSourceLines(log);
  const logs = getLogsTableTimes(log);
  const machine = getMachinePunchTimes(log);
  const logVal = field === "checkin" ? logs.checkin : logs.checkout;
  const macVal = field === "checkin" ? machine.checkin : machine.checkout;

  if (!showDual) {
    const content =
      mergedFallback ??
      (field === "checkin"
        ? formatPunch(log.checkin_time)
        : formatPunch(log.checkout_time));
    return (
      <span className="inline-flex items-center gap-0.5">
        {content}
        <AttendanceSourceInfo log={log} showOnlyIfMachine={false} />
      </span>
    );
  }

  return (
    <span className="inline-flex items-start gap-1">
      <span className="flex flex-col leading-snug">
        <span className="whitespace-nowrap">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Log
          </span>
          {field === "checkout" && checkoutExtra
            ? checkoutExtra(formatPunch(logVal), log)
            : formatPunch(logVal)}
        </span>
        <span className="whitespace-nowrap text-indigo-800">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-500">
            Machine
          </span>
          {formatPunch(macVal)}
        </span>
      </span>
      <AttendanceSourceInfo log={log} showOnlyIfMachine={false} />
    </span>
  );
}
