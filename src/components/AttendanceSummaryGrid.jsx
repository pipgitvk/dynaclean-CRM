"use client";

import { useMemo, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { isHalfDayByRules } from "@/lib/attendanceRulesEngine";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const LEGEND = [
  { code: "LOP", label: "Absent / LOP", swatch: "bg-red-100 text-red-800 ring-red-200" },
  { code: "P", label: "Present", swatch: "bg-green-100 text-green-800 ring-green-200" },
  { code: "S", label: "Sunday", swatch: "bg-purple-100 text-purple-900 ring-purple-200" },
  { code: "H", label: "Holiday", swatch: "bg-gray-200 text-gray-800 ring-gray-300" },
  { code: "PL", label: "Paid Leave", swatch: "bg-orange-100 text-orange-900 ring-orange-200" },
  { code: "HD", label: "Half-day", swatch: "bg-yellow-100 text-yellow-900 ring-yellow-200" },
];

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function cellCode(year, monthIndex, day, maps) {
  const d = new Date(year, monthIndex, day);
  if (d.getMonth() !== monthIndex) return { code: "", kind: "invalid" };

  const today = startOfDay(new Date());
  const cellDate = startOfDay(d);
  if (cellDate > today) return { code: "", kind: "future" };

  const dateString = d.toLocaleDateString("en-CA");
  const existingLog = maps.dateMap.get(dateString);
  const isSunday = d.getDay() === 0;
  const isHoliday = maps.holidayMap.has(dateString);
  const isOnLeave = maps.leaveMap.has(dateString);

  if (existingLog) {
    if (maps.isHalfDay(existingLog)) return { code: "HD", kind: "hd" };
    return { code: "P", kind: "present" };
  }
  if (isSunday) return { code: "S", kind: "sunday" };
  if (isHoliday) return { code: "H", kind: "holiday" };
  if (isOnLeave) return { code: "PL", kind: "leave" };
  return { code: "LOP", kind: "lop" };
}

const cellClass = {
  invalid: "bg-gray-50 text-gray-300",
  future: "bg-gray-50 text-gray-300",
  present: "bg-green-100 text-green-800 font-semibold",
  hd: "bg-yellow-100 text-yellow-900 font-semibold",
  sunday: "bg-purple-100 text-purple-900 font-semibold",
  holiday: "bg-gray-200 text-gray-800 font-semibold",
  leave: "bg-orange-100 text-orange-900 font-semibold",
  lop: "bg-red-100 text-red-800 font-semibold",
};

export default function AttendanceSummaryGrid({ logs, holidays, leaves, rules, className = "" }) {
  const [year, setYear] = useState(() => new Date().getFullYear());

  const maps = useMemo(() => {
    const dateMap = new Map(
      (logs || []).map((log) => [new Date(log.date).toLocaleDateString("en-CA"), log])
    );
    const holidayMap = new Map(
      (holidays || []).map((h) => [new Date(h.holiday_date).toLocaleDateString("en-CA"), h])
    );
    const leaveMap = new Map();
    (leaves || []).forEach((leave) => {
      const from = new Date(leave.from_date);
      const to = new Date(leave.to_date);
      for (let x = new Date(from); x <= to; x.setDate(x.getDate() + 1)) {
        leaveMap.set(x.toLocaleDateString("en-CA"), leave);
      }
    });
    const isHalfDay = (log) => isHalfDayByRules(log, rules);
    return { dateMap, holidayMap, leaveMap, isHalfDay };
  }, [logs, holidays, leaves, rules]);

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1];
  }, []);

  /** For the current calendar year, only show Jan → current month; past/future years show all 12. */
  const visibleMonths = useMemo(() => {
    const now = new Date();
    const cy = now.getFullYear();
    const cm = now.getMonth();
    if (year !== cy) {
      return MONTHS.map((name, monthIndex) => ({ name, monthIndex }));
    }
    return MONTHS.slice(0, cm + 1).map((name, monthIndex) => ({
      name,
      monthIndex,
    }));
  }, [year]);

  const tableMinWidth = Math.max(300, 52 + visibleMonths.length * 40);

  return (
    <section
      className={`mt-10 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg shadow-slate-200/60 ring-1 ring-slate-100 ${className}`.trim()}
    >
      <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/25">
              <Calendar className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                Attendance Summary
              </h2>
            </div>
          </div>

          <label className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-[140px]">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Year
            </span>
            <div className="relative">
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </label>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Legend</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {LEGEND.map(({ code, label, swatch }) => (
              <div
                key={code}
                className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white/90 px-3 py-2 shadow-sm shadow-slate-100"
              >
                <span
                  className={`inline-flex min-w-[2.5rem] justify-center rounded-lg px-2 py-1 font-mono text-[11px] font-bold ring-1 ring-inset md:text-xs ${swatch}`}
                >
                  {code}
                </span>
                <span className="text-left text-[11px] leading-snug text-slate-600 md:text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-5">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/50 shadow-inner">
          <table
            className="w-full border-separate border-spacing-0 text-center text-[11px] md:text-xs"
            style={{ minWidth: tableMinWidth }}
          >
            <thead>
              <tr className="bg-slate-100/95">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-100 px-2 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 shadow-[4px_0_12px_-4px_rgba(15,23,42,0.12)] md:min-w-[3rem] md:py-3.5"
                >
                  Day
                </th>
                {visibleMonths.map(({ name: m }) => (
                  <th
                    key={m}
                    className="border-b border-r border-slate-200 px-1 py-2.5 text-[11px] font-semibold text-slate-800 last:border-r-0 md:min-w-[2.5rem] md:px-1.5 md:text-xs"
                  >
                    <span className="hidden sm:inline">{m}</span>
                    <span className="sm:hidden">{m.slice(0, 3)}</span>
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-50/90 text-[10px] font-medium uppercase tracking-wider text-slate-500 md:text-[11px]">
                {visibleMonths.map(({ name: m }) => (
                  <th
                    key={`sub-${m}`}
                    className="border-b border-r border-slate-200 px-1 py-1.5 last:border-r-0"
                  >
                    1–31
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <tr
                  key={day}
                  className="transition-colors hover:bg-indigo-50/25 odd:[&>td:first-child]:bg-white even:[&>td:first-child]:bg-slate-50/90"
                >
                  <td className="sticky left-0 z-10 border-b border-r border-slate-100 px-2 py-1.5 text-xs font-semibold tabular-nums text-slate-700 shadow-[4px_0_12px_-4px_rgba(15,23,42,0.08)] md:py-2">
                    {day}
                  </td>
                  {visibleMonths.map(({ name: monthName, monthIndex }) => {
                    const { code, kind } = cellCode(year, monthIndex, day, maps);
                    return (
                      <td
                        key={`${monthIndex}-${day}`}
                        className={`border-b border-r border-slate-100 px-0.5 py-1.5 font-mono text-[11px] font-semibold last:border-r-0 md:py-2 md:text-xs ${cellClass[kind]}`}
                        title={code ? `${monthName} ${day}, ${year}: ${code}` : ""}
                      >
                        {code || (
                          <span className="font-normal text-slate-300">&mdash;</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
