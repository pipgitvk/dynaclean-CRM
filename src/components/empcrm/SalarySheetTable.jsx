"use client";

import { useMemo, useState } from "react";

function formatInr(n) {
  if (n == null || n === "" || !Number.isFinite(Number(n))) return "—";
  const x = Number(n);
  if (x === 0) return "—";
  return x.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function formatNum(n) {
  if (n == null || n === "" || !Number.isFinite(Number(n))) return "—";
  const x = Number(n);
  if (x === 0) return "0";
  return x % 1 === 0 ? String(x) : x.toFixed(2);
}

/** Match attendance / salary generate cards (e.g. 23.5 present, 0.5 PL). */
function formatAttendanceDays(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return n.toFixed(1);
}

const thBase =
  "px-2 py-2 text-xs font-bold text-gray-900 border border-gray-300 whitespace-nowrap bg-amber-100";
const thGreen = `${thBase} bg-green-100`;
const tdBase = "px-2 py-1.5 text-xs border border-gray-200 whitespace-nowrap text-gray-800";
const tdNum = `${tdBase} text-right tabular-nums`;
const tdGreen = `${tdNum} bg-green-50 font-semibold`;

export default function SalarySheetTable({ rows, monthLabel, companyName, loading }) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows || [];
    return (rows || []).filter((r) => {
      const hay = [
        r.employee_name,
        r.username,
        r.employee_code,
        r.father_or_spouse_name,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
        Loading salary sheet…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-lg font-bold text-gray-900 tracking-wide">
          {companyName || "DYNACLEAN INDUSTRIES PRIVATE LIMITED"}
        </h1>
        <p className="text-sm font-semibold text-gray-700 mt-1">
          Salary Sheet — {monthLabel || ""}
        </p>
        <p className="text-xs text-gray-600 mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 max-w-4xl mx-auto">
          <span>
            <strong>P</strong> — Present (attendance card; paid half-day work = 0.5)
          </span>
          <span><strong>HD</strong> — Half days (same as attendance sheet)</span>
          <span><strong>A</strong> — Absent / LOP</span>
          <span><strong>PL</strong> — Paid leave (approved; half-day = 0.5)</span>
          <span><strong>WO</strong> — Weekly off (Sunday)</span>
          <span><strong>H</strong> — Company holidays</span>
          <span><strong>SL</strong> — Sick leave (approved)</span>
          <span><strong>UL</strong> — Unpaid leave (approved)</span>
          <span>
            <strong>Sun+</strong> — +1 pay day if Sunday punch &amp; attendance location matches profile work location
          </span>
          <span>
            <strong>Hol+</strong> — +1 pay day if holiday punch &amp; location matches work location
          </span>
        </p>
        <p className="text-xs text-gray-800 mt-2 text-center font-semibold max-w-4xl mx-auto">
          Paid Days = Salary Generate engine (incl. Sun+ / Hol+ in total pay days)
        </p>
        <p className="text-xs text-gray-500 mt-1 text-center max-w-4xl mx-auto">
          OT columns are not used (—). P, HD, A… are register reference only.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Filter by name, code, username…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[220px] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-xs text-gray-500">
          {filtered.length} employee{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-auto border border-gray-300 rounded-lg shadow-sm max-h-[calc(100vh-220px)]">
        <table className="min-w-max w-full border-collapse bg-white">
          <thead className="sticky top-0 z-10">
            <tr>
              <th colSpan={4} className={thBase}>Employee</th>
              <th colSpan={4} className={thGreen}>Salary Rate</th>
              <th colSpan={11} className={thBase}>Attendance</th>
              <th colSpan={7} className={thGreen}>Gross Earned Salary</th>
              <th colSpan={4} className={thBase}>Deductions</th>
              <th rowSpan={2} className={thGreen}>Net Salary</th>
            </tr>
            <tr>
              <th className={thBase}>Code</th>
              <th className={thBase}>Name</th>
              <th className={thBase}>DOJ</th>
              <th className={thBase}>Father / Spouse</th>
              <th className={thGreen}>Basic</th>
              <th className={thGreen}>HRA</th>
              <th className={thGreen}>Oth. Allow</th>
              <th className={thGreen}>Total</th>
              <th
                className={thBase}
                title="Same as Attendance details card — full day punch = 1; paid half-day work = 0.5"
              >
                P
              </th>
              <th className={thBase} title="Half days (unpaid / punch-based; not paid half-leave)">
                HD
              </th>
              <th className={thBase} title="Absent / LOP (attendance summary)">
                A
              </th>
              <th className={thBase} title="Paid leave (approved; half-day = 0.5)">
                PL
              </th>
              <th className={thBase} title="Weekly off (Sunday)">
                WO
              </th>
              <th className={thBase} title="Company holidays">
                H
              </th>
              <th className={thBase}>SL</th>
              <th className={thBase} title="Unpaid leave (approved)">
                UL
              </th>
              <th className={thBase} title="Extra pay days: worked on Sunday">
                Sun+
              </th>
              <th className={thBase} title="Extra pay days: worked on company holiday">
                Hol+
              </th>
              <th className={thBase}>Paid Days</th>
              <th className={thGreen}>Basic</th>
              <th className={thGreen}>HRA</th>
              <th className={thGreen}>Other Allow</th>
              <th className={thGreen}>OT (h)</th>
              <th className={thGreen}>OT Pay</th>
              <th className={thGreen}>Incentive</th>
              <th className={thGreen}>Total</th>
              <th className={thBase}>PF @ 12%</th>
              <th className={thBase}>ESI @ 0.75%</th>
              <th className={thBase}>Advance</th>
              <th className={thBase}>Other</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={31} className="px-4 py-8 text-center text-sm text-gray-500">
                  No rows to display.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const att = r.attendance || {};
                const earned = r.earned || {};
                const ded = r.deductions || {};
                const noStructure = !r.has_salary_structure;
                return (
                  <tr key={r.username} className="hover:bg-gray-50/80">
                    <td className={tdBase}>{r.employee_code || "—"}</td>
                    <td className={tdBase}>{r.employee_name}</td>
                    <td className={tdBase}>{r.date_of_joining_display || "—"}</td>
                    <td className={tdBase}>{r.father_or_spouse_name || "—"}</td>
                    <td className={tdNum}>{formatInr(r.rate_basic)}</td>
                    <td className={tdNum}>{formatInr(r.rate_hra)}</td>
                    <td className={tdNum}>{formatInr(r.rate_other_allow)}</td>
                    <td className={tdGreen}>{formatInr(r.rate_total)}</td>
                    <td className={tdNum}>{formatAttendanceDays(att.present)}</td>
                    <td className={tdNum}>{formatNum(att.half_day)}</td>
                    <td className={tdNum}>{formatNum(att.absent)}</td>
                    <td className={tdNum}>{formatAttendanceDays(att.paid_leave)}</td>
                    <td className={tdNum}>{formatNum(att.weekly_off)}</td>
                    <td className={tdNum}>{formatNum(att.holidays)}</td>
                    <td className={tdNum}>{formatNum(att.sick_leave)}</td>
                    <td className={tdNum}>{formatNum(att.unpaid_leave)}</td>
                    <td className={tdNum}>
                      {att.sunday_work_days ? formatNum(att.sunday_work_days) : "—"}
                    </td>
                    <td className={tdNum}>
                      {att.holiday_work_days ? formatNum(att.holiday_work_days) : "—"}
                    </td>
                    <td className={tdNum}>{formatNum(att.paid_days)}</td>
                    <td className={tdNum}>
                      {noStructure ? "—" : formatInr(earned.basic)}
                    </td>
                    <td className={tdNum}>
                      {noStructure ? "—" : formatInr(earned.hra)}
                    </td>
                    <td className={tdNum}>
                      {noStructure ? "—" : formatInr(earned.other_allow)}
                    </td>
                    <td className={tdNum}>
                      {earned.overtime_hours ? formatNum(earned.overtime_hours) : "—"}
                    </td>
                    <td className={tdNum}>
                      {noStructure ? "—" : formatInr(earned.overtime_pay)}
                    </td>
                    <td className={tdNum}>—</td>
                    <td className={tdGreen}>
                      {noStructure ? "—" : formatInr(earned.total)}
                    </td>
                    <td className={tdNum}>
                      {noStructure ? "—" : formatInr(ded.pf)}
                    </td>
                    <td className={tdNum}>
                      {noStructure ? "—" : formatInr(ded.esi)}
                    </td>
                    <td className={tdNum}>
                      {noStructure ? "—" : formatInr(ded.advance)}
                    </td>
                    <td className={tdNum}>
                      {noStructure ? "—" : formatInr(ded.other)}
                    </td>
                    <td className={tdGreen}>
                      {noStructure ? "—" : formatInr(r.net_salary)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
