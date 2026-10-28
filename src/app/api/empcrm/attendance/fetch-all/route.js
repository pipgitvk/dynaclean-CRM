// app/api/empcrm/attendance/fetch-all/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { loadGlobalAttendanceRulesRow } from "@/lib/ensureAttendanceRulesTable";
import { ensureEmployeeAttendanceScheduleTable } from "@/lib/ensureEmployeeAttendanceScheduleTable";
import {
  rowToAttendanceRulesShape,
  mergeGlobalRulesWithEmployeeSchedule,
} from "@/lib/attendanceRulesDb";
import { ensureAttendanceEditHistoryTable } from "@/lib/ensureAttendanceEditHistoryTable";
import {
  loadMachineCodeMaps,
  loadMachineDailyByUsername,
  mergeAttendanceListWithMachine,
  mergeCrmAndMachineDay,
} from "@/lib/attendanceMachineMerge";
import { ensureAttendanceLogsEmployeeColumns } from "@/lib/ensureAttendanceLogsEmployeeColumns";
import { applyAutomaticCheckouts } from "@/lib/attendanceAutoCheckout";
import {
  applyCanonicalUsernameToRow,
  normalizeUsernameKey,
} from "@/lib/attendanceCanonicalUsername";
import { attendanceDateKey } from "@/lib/leaveDateRange";
export const dynamic = 'force-dynamic';

function normalizeUserKey(value) {
  return normalizeUsernameKey(value);
}

/** Same employee + date can appear twice before canonical usernames align — merge once. */
function pickCrmRowForMerge(a, b) {
  if (a._syntheticMachineOnly && !b._syntheticMachineOnly) return b;
  if (b._syntheticMachineOnly && !a._syntheticMachineOnly) return a;
  return a;
}

function combineMachineDays(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const pickEarlier = (x, y) => {
    if (!x) return y;
    if (!y) return x;
    return String(x) <= String(y) ? x : y;
  };
  const pickLater = (x, y) => {
    if (!x) return y;
    if (!y) return x;
    return String(x) >= String(y) ? x : y;
  };
  return {
    emp_code: a.emp_code || b.emp_code,
    punch_date: a.punch_date || b.punch_date,
    machine_checkin: pickEarlier(a.machine_checkin, b.machine_checkin),
    machine_checkout: pickLater(a.machine_checkout, b.machine_checkout),
  };
}

function dedupeMergedAttendanceRows(mergedRows) {
  const byKey = new Map();
  for (const row of mergedRows || []) {
    const dk = attendanceDateKey(row.date);
    const key = `${normalizeUserKey(row.username)}|${dk}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, row);
      continue;
    }
    const machineDay = combineMachineDays(prev.machine_day, row.machine_day);
    const crmRow = pickCrmRowForMerge(prev, row);
    byKey.set(key, mergeCrmAndMachineDay(crmRow, machineDay));
  }
  return [...byKey.values()];
}

export async function GET(request) {
  try {
    await applyAutomaticCheckouts();

    const db = await getDbConnection();
    await ensureAttendanceEditHistoryTable(db);
    await ensureAttendanceLogsEmployeeColumns(db);

    // Query to fetch all attendance logs
    const [rows] = await db.query(
      `SELECT
      a.date,
      a.username,
      COALESCE(a.employee_id, r.empId) AS employee_id,
      COALESCE(NULLIF(TRIM(a.machine_code), ''), NULLIF(TRIM(r.machine_code), '')) AS machine_code,
      a.admin_time_edit_remark,
      a.checkin_time,
      a.checkout_time,
      a.break_morning_start,
      a.break_morning_end,
      a.break_lunch_start,
      a.break_lunch_end,
      a.break_evening_start,
      a.break_evening_end,
      a.checkin_address,
      a.checkin_latitude,
      a.checkin_longitude,
      a.checkout_address,
      a.checkout_latitude,
      a.checkout_longitude,
      (CASE
         WHEN a.checkin_photo IS NOT NULL AND TRIM(a.checkin_photo) <> ''
         THEN 1 ELSE 0
       END) AS has_checkin_photo
   FROM attendance_logs a
   INNER JOIN rep_list r
      ON a.username COLLATE utf8mb4_unicode_ci = r.username COLLATE utf8mb4_unicode_ci
   WHERE r.status = 1
   ORDER BY a.date DESC`
    );


    // Fetch holidays
    const [holidays] = await db.query(
      `SELECT holiday_date, title, description
       FROM holidays
       ORDER BY holiday_date DESC`
    );

    // Fetch all approved leaves
    const [leaves] = await db.query(
      `SELECT username, from_date, to_date, leave_type, reason, is_half_day, half_day_type, start_time, end_time
       FROM employee_leaves
       WHERE status = 'approved'
       ORDER BY from_date DESC`
    );

    const globalRow = await loadGlobalAttendanceRulesRow(db);
    const globalRules = rowToAttendanceRulesShape(globalRow);
    await ensureEmployeeAttendanceScheduleTable();

    const { machineCodeToUsername, canonicalMaps, resolveCanonicalUsername: resolveCanon } =
      await loadMachineCodeMaps(db);

    for (const row of rows) {
      applyCanonicalUsernameToRow(row, canonicalMaps);
    }

    const [schedules] = await db.query(`SELECT * FROM employee_attendance_schedule`);
    const scheduleByUser = new Map(
      (schedules || []).map((s) => [normalizeUserKey(s.username), s])
    );
    const rulesByUsername = {};
    for (const u of [...new Set(rows.map((r) => r.username))]) {
      const schedule =
        scheduleByUser.get(normalizeUserKey(u)) || null;
      rulesByUsername[u] = mergeGlobalRulesWithEmployeeSchedule(
        globalRules,
        schedule
      );
    }

    const regMap = new Map();
    try {
      const [regRows] = await db.query(
        `SELECT ar.username, ar.log_date, ar.reason, ar.reviewed_by
         FROM attendance_regularization_requests ar
         INNER JOIN (
           SELECT username, log_date, MAX(id) AS mid
           FROM attendance_regularization_requests
           WHERE status = 'approved'
           GROUP BY username, log_date
         ) t
           ON ar.username COLLATE utf8mb4_unicode_ci = t.username COLLATE utf8mb4_unicode_ci
           AND ar.log_date = t.log_date
           AND ar.id = t.mid
         WHERE ar.status = 'approved'`
      );
      for (const r of regRows || []) {
        const dk = attendanceDateKey(r.log_date);
        const canonUser = resolveCanon(r.username, canonicalMaps);
        const key = `${canonUser}|${dk}`;
        regMap.set(key, {
          createdBy: r.username,
          approvedBy: r.reviewed_by || "—",
          reason: r.reason && String(r.reason).trim() ? r.reason : "—",
        });
      }
    } catch (e) {
      console.warn("attendance regularization metadata skipped:", e.message);
    }

    const machineByUserDate = await loadMachineDailyByUsername(
      db,
      machineCodeToUsername,
    );
    let mergedRows = mergeAttendanceListWithMachine(rows, machineByUserDate);
    mergedRows = dedupeMergedAttendanceRows(mergedRows);

    const [idRows] = await db.query(
      `SELECT username, empId, TRIM(machine_code) AS machine_code
       FROM rep_list WHERE status = 1`
    );
    const idsByUser = new Map();
    for (const r of idRows || []) {
      const canon = resolveCanon(r.username, canonicalMaps, {
        employee_id: r.empId,
        machine_code: r.machine_code,
      });
      idsByUser.set(canon, {
        employee_id: r.empId ?? null,
        machine_code: String(r.machine_code || "").trim() || null,
      });
    }

    for (const row of mergedRows) {
      const dk = attendanceDateKey(row.date);
      const meta = regMap.get(`${row.username}|${dk}`);
      row.regularization = meta || null;
      const ids = idsByUser.get(row.username);
      if (ids) {
        if (row.employee_id == null) row.employee_id = ids.employee_id;
        if (!row.machine_code) row.machine_code = ids.machine_code;
      }
    }

    const uniqueUsernames = [
      ...new Set(mergedRows.map((r) => r.username)),
    ];
    for (const u of uniqueUsernames) {
      if (rulesByUsername[u]) continue;
      const schedule = scheduleByUser.get(normalizeUserKey(u)) || null;
      rulesByUsername[u] = mergeGlobalRulesWithEmployeeSchedule(
        globalRules,
        schedule
      );
    }

    const normalizedLeaves = (leaves || []).map((leave) => ({
      ...leave,
      username: resolveCanon(leave.username, canonicalMaps),
      from_date: attendanceDateKey(leave.from_date),
      to_date: attendanceDateKey(leave.to_date),
    }));
    const normalizedHolidays = (holidays || []).map((h) => ({
      ...h,
      holiday_date: attendanceDateKey(h.holiday_date),
    }));

    return NextResponse.json({
      attendance: mergedRows,
      holidays: normalizedHolidays,
      leaves: normalizedLeaves,
      rulesByUsername,
    });
  } catch (error) {
    console.error("Error fetching attendance logs:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}
