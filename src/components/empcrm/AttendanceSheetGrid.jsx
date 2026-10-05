"use client";

import { useMemo, useState } from "react";

function cellClass(cell, dayMeta) {
  const base = "border border-gray-300 text-center text-[10px] font-semibold min-w-[26px] h-7 px-0.5";
  const code = cell?.code || "";
  if (code === "S" || (dayMeta?.isSunday && code === "S")) {
    return `${base} bg-orange-200 text-orange-950`;
  }
  if (code === "H" || cell?.kind === "holiday") {
    return `${base} bg-violet-100 text-violet-900`;
  }
  if (code === "P") return `${base} bg-green-200 text-green-950`;
  if (code === "L") return `${base} bg-green-100 text-green-900`;
  if (code === "HD") return `${base} bg-sky-200 text-sky-950`;
  if (code === "A") return `${base} bg-red-200 text-red-950`;
  if (dayMeta?.isSunday) return `${base} bg-orange-100 text-orange-900`;
  return `${base} bg-white text-gray-700`;
}

export default function AttendanceSheetGrid({ data, loading }) {
  const [filter, setFilter] = useState("");

  const days = data?.days || [];
  const rows = data?.rows || [];

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.username, r.designation].join(" ").toLowerCase().includes(q)
    );
  }, [rows, filter]);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">Loading attendance sheet…</div>
    );
  }

  const thFixed =
    "px-2 py-2 text-xs font-bold border border-gray-400 bg-sky-100 text-gray-900 whitespace-nowrap";
  const thDay =
    "px-0.5 py-1 text-[9px] font-bold border border-gray-400 bg-amber-100 text-center min-w-[26px]";
  const thDow =
    "px-0 py-0 text-[8px] font-medium border border-gray-400 bg-yellow-100 text-center min-w-[26px] leading-tight";
  const tdFixed = "px-2 py-1.5 text-xs border border-gray-200 whitespace-nowrap bg-white";

  return (
    <div className="space-y-4">
      <div className="text-center border-b-2 border-gray-800 pb-3">
        <h1 className="text-lg font-bold uppercase tracking-wide underline">
          {data?.company_name || "DYNACLEAN INDUSTRIES PRIVATE LIMITED"}
        </h1>
        <p className="text-base font-bold uppercase underline mt-2">
          {data?.title || "ATTENDANCE RECORD"}
        </p>
        <div className="flex flex-wrap justify-center gap-4 mt-3 text-sm font-semibold bg-yellow-100 border border-yellow-300 rounded-lg py-2 px-4 mx-auto max-w-3xl">
          <span>MONTH: {data?.monthLabel || "—"}</span>
          <span>
            {data?.dateFromDisplay} TO {data?.dateToDisplay}
          </span>
          <span>{data?.fiscalYear}</span>
        </div>
        <p className="text-xs text-gray-600 mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
          <span><strong>P</strong> — Present</span>
          <span><strong>L</strong> — Leave</span>
          <span><strong>HD</strong> — Half day leave</span>
          <span><strong>A</strong> — Absent</span>
          <span><strong>H</strong> — Holiday</span>
          <span><strong>S</strong> — Sunday</span>
        </p>
      </div>

      <input
        type="search"
        placeholder="Filter by name…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[200px]"
      />

      <div className="overflow-auto border-2 border-gray-400 max-h-[calc(100vh-280px)] shadow-sm">
        <table className="border-collapse min-w-max w-full bg-white">
          <thead className="sticky top-0 z-30">
            <tr>
              <th className={thFixed}>S.NO</th>
              <th className={`${thFixed} min-w-[140px]`}>NAME</th>
              <th className={`${thFixed} min-w-[90px]`}>DOB</th>
              <th className={`${thFixed} min-w-[100px]`}>DATE OF JOINING</th>
              <th className={`${thFixed} min-w-[120px]`}>DESIGNATION</th>
              {days.map((d) => (
                <th key={`dow-${d.day}`} className={thDow}>
                  <span className="inline-block -rotate-45 origin-center whitespace-nowrap">
                    {d.dow}
                  </span>
                </th>
              ))}
              <th className="px-2 py-2 text-xs font-bold border border-gray-400 bg-sky-200 whitespace-nowrap">
                TOTAL PRESENT
              </th>
            </tr>
            <tr>
              <th colSpan={5} className="border border-gray-400 bg-sky-50 h-0 p-0" />
              {days.map((d) => (
                <th
                  key={`num-${d.day}`}
                  className={`${thDay} ${d.isSunday ? "bg-orange-300" : ""}`}
                >
                  {d.day}
                </th>
              ))}
              <th className="border border-gray-400 bg-sky-50" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5 + days.length + 1} className="p-8 text-center text-sm text-gray-500">
                  No employees to show.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.username} className="hover:bg-gray-50/50">
                  <td className={`${tdFixed} text-center`}>{r.sno}</td>
                  <td className={tdFixed}>{r.name}</td>
                  <td className={tdFixed}>{r.date_of_birth_display || "—"}</td>
                  <td className={tdFixed}>{r.date_of_joining_display || "—"}</td>
                  <td className={tdFixed}>{r.designation || "—"}</td>
                  {(r.cells || []).map((cell) => {
                    const dayMeta = days.find((d) => d.day === cell.day);
                    return (
                      <td key={cell.ymd} className={cellClass(cell, dayMeta)}>
                        {cell.code || ""}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-xs font-bold text-center border border-gray-200 bg-sky-50">
                    {r.total_present}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
