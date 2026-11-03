// app/api/empcrm/attendance/fetch-all/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { loadGlobalAttendanceRulesRow } from "@/lib/ensureAttendanceRulesTable";
import { ensureEmployeeAttendanceScheduleTable } from "@/lib/ensureEmployeeAttendanceScheduleTable";
import {
  rowToAttendanceRulesShape,
  mergeGlobalRulesWithEmployeeSchedule,
} from "@/lib/attendanceRulesDb";
import {
  loadMachineCodeMaps,
  loadMachineDailyByUsername,
  mergeAttendanceListWithMachine,
  mergeCrmAndMachineDay,
} from "@/lib/attendanceMachineMerge";
import {
  applyCanonicalUsernameToRow,
  normalizeUsernameKey,
} from "@/lib/attendanceCanonicalUsername";
import { attendanceDateKey } from "@/lib/leaveDateRange";

export const dynamic = "force-dynamic";

function normalizeUserKey(value) {
  return normalizeUsernameKey(value);
}

function shiftYmd(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function defaultMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${d}` };
}

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

function buildRulesForUsers(globalRules, scheduleByUser, usernames) {
  const rulesByUsername = {};
  for (const u of usernames) {
    const schedule = scheduleByUser.get(normalizeUserKey(u)) || null;
    rulesByUsername[u] = mergeGlobalRulesWithEmployeeSchedule(
      globalRules,
      schedule,
    );
  }
  return rulesByUsername;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get("meta") === "1") {
      const db = await getDbConnection();
      const [activeEmployees] = await db.query(
        `SELECT username FROM rep_list WHERE status = 1 ORDER BY username ASC`,
      );
      const employeeNames = (activeEmployees || [])
        .map((r) => String(r.username || "").trim())
        .filter(Boolean);
      return NextResponse.json({
        employees: employeeNames,
        attendance: [],
        holidays: [],
        leaves: [],
        rulesByUsername: {},
      });
    }

    let fromParam = String(searchParams.get("from") || "").trim();
    let toParam = String(searchParams.get("to") || "").trim();
    const ymdOk = /^\d{4}-\d{2}-\d{2}$/;
    if (!ymdOk.test(fromParam) || !ymdOk.test(toParam)) {
      const def = defaultMonthRange();
      fromParam = def.from;
      toParam = def.to;
    }
    const queryFrom = shiftYmd(fromParam, -7);
    const queryTo = toParam;
    const skipMachine = searchParams.get("machine") === "0";
    const usernameParam = String(searchParams.get("username") || "").trim();

    const db = await getDbConnection();

    let usernameAliases = [];
    if (usernameParam) {
      const [aliasRows] = await db.query(
        `SELECT r2.username
         FROM rep_list r1
         INNER JOIN rep_list r2
           ON r1.empId = r2.empId AND r2.status = 1
         WHERE r1.status = 1
           AND r1.empId IS NOT NULL
           AND LOWER(TRIM(r1.username)) = LOWER(TRIM(?))`,
        [usernameParam],
      );
      usernameAliases = [
        ...new Set(
          [usernameParam, ...(aliasRows || []).map((r) => r.username)]
            .map((u) => String(u || "").trim())
            .filter(Boolean),
        ),
      ];
    }

    const userLogSql = usernameAliases.length
      ? ` AND a.username IN (${usernameAliases.map(() => "?").join(", ")})`
      : "";
    const logParams = [queryFrom, queryTo, ...usernameAliases];

    const logSql = `
      SELECT
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
        AND a.date >= ?
        AND a.date < DATE_ADD(?, INTERVAL 1 DAY)
        ${userLogSql}
      ORDER BY a.date DESC`;

    const leaveParams = [queryTo, queryFrom];
    let leaveUserSql = "";
    if (usernameAliases.length) {
      leaveUserSql = ` AND username IN (${usernameAliases.map(() => "?").join(", ")})`;
      leaveParams.push(...usernameAliases);
    }

    const [
      [rows],
      [holidays],
      [leaves],
      [schedules],
      [activeEmployees],
      globalRow,
    ] = await Promise.all([
      db.query(logSql, logParams),
      db.query(
        `SELECT holiday_date, title, description FROM holidays ORDER BY holiday_date DESC`,
      ),
      db.query(
        `SELECT username, from_date, to_date, leave_type, reason, is_half_day, half_day_type, start_time, end_time
         FROM employee_leaves
         WHERE status = 'approved'
           AND from_date <= ?
           AND to_date >= ?
           ${leaveUserSql}
         ORDER BY from_date DESC`,
        leaveParams,
      ),
      db.query(`SELECT * FROM employee_attendance_schedule`),
      db.query(
        `SELECT username, empId, TRIM(machine_code) AS machine_code
         FROM rep_list WHERE status = 1`,
      ),
      loadGlobalAttendanceRulesRow(db),
    ]);

    await ensureEmployeeAttendanceScheduleTable();

    const { machineCodeToUsername, canonicalMaps, resolveCanonicalUsername: resolveCanon } =
      await loadMachineCodeMaps(db);

    for (const row of rows) {
      applyCanonicalUsernameToRow(row, canonicalMaps);
    }

    const scheduleByUser = new Map(
      (schedules || []).map((s) => [normalizeUserKey(s.username), s]),
    );
    const globalRules = rowToAttendanceRulesShape(globalRow);

    const employeeNames = [
      ...new Set(
        (activeEmployees || []).map((r) =>
          resolveCanon(r.username, canonicalMaps, {
            employee_id: r.empId,
            machine_code: r.machine_code,
          }),
        ),
      ),
    ].sort((a, b) => String(a).localeCompare(String(b)));

    const idsByUser = new Map();
    for (const r of activeEmployees || []) {
      const canon = resolveCanon(r.username, canonicalMaps, {
        employee_id: r.empId,
        machine_code: r.machine_code,
      });
      idsByUser.set(canon, {
        employee_id: r.empId ?? null,
        machine_code: String(r.machine_code || "").trim() || null,
      });
    }

    let mergedRows = rows;
    if (!skipMachine) {
      const empCodesFromRows = [
        ...new Set(
          rows
            .map((r) => String(r.machine_code || "").trim())
            .filter(Boolean),
        ),
      ];
      const machineByUserDate = await loadMachineDailyByUsername(
        db,
        machineCodeToUsername,
        {
          fromDate: queryFrom,
          toDate: queryTo,
          empCodes: empCodesFromRows,
        },
      );
      mergedRows = dedupeMergedAttendanceRows(
        mergeAttendanceListWithMachine(rows, machineByUserDate),
      );
    } else {
      mergedRows = dedupeMergedAttendanceRows(mergedRows);
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
             AND log_date >= ?
             AND log_date <= ?
           GROUP BY username, log_date
         ) t
           ON ar.username COLLATE utf8mb4_unicode_ci = t.username COLLATE utf8mb4_unicode_ci
           AND ar.log_date = t.log_date
           AND ar.id = t.mid
         WHERE ar.status = 'approved'`,
        [queryFrom, queryTo],
      );
      for (const r of regRows || []) {
        const dk = attendanceDateKey(r.log_date);
        const canonUser = resolveCanon(r.username, canonicalMaps);
        regMap.set(`${canonUser}|${dk}`, {
          createdBy: r.username,
          approvedBy: r.reviewed_by || "—",
          reason: r.reason && String(r.reason).trim() ? r.reason : "—",
        });
      }
    } catch (e) {
      console.warn("attendance regularization metadata skipped:", e.message);
    }

    for (const row of mergedRows) {
      const dk = attendanceDateKey(row.date);
      row.regularization = regMap.get(`${row.username}|${dk}`) || null;
      const ids = idsByUser.get(row.username);
      if (ids) {
        if (row.employee_id == null) row.employee_id = ids.employee_id;
        if (!row.machine_code) row.machine_code = ids.machine_code;
      }
    }

    const rulesByUsername = buildRulesForUsers(
      globalRules,
      scheduleByUser,
      [...new Set(mergedRows.map((r) => r.username))],
    );

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
      employees: employeeNames,
      range: { from: fromParam, to: toParam, queryFrom, queryTo },
    });
  } catch (error) {
    console.error("Error fetching attendance logs:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}
