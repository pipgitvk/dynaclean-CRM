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
  buildCrmBaseRowForRematch,
  extractCrmPunchesFromAttendanceLogRow,
  pickEarlierCheckin,
  pickLaterCheckout,
} from "@/lib/attendanceMachineMerge";
import {
  applyCanonicalUsernameToRow,
  normalizeUsernameKey,
} from "@/lib/attendanceCanonicalUsername";
import { attendanceDateKey } from "@/lib/leaveDateRange";
import { parseAttendanceDateTime } from "@/lib/istDateTime";
import { isMeaningfulAttendancePunch } from "@/lib/attendanceMeaningfulPunch";

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

function pickCrmShellForMerge(a, b) {
  if (a._syntheticMachineOnly && !b._syntheticMachineOnly) return b;
  if (b._syntheticMachineOnly && !a._syntheticMachineOnly) return a;
  const score = (row) => {
    if (!row || row._syntheticMachineOnly) return 0;
    const crm = extractCrmPunchesFromAttendanceLogRow(row);
    let s = 0;
    if (isMeaningfulAttendancePunch(crm.checkin)) s += 2;
    if (isMeaningfulAttendancePunch(crm.checkout)) s += 2;
    if (
      row.checkin_address &&
      !String(row.checkin_address).toLowerCase().includes("machine")
    ) {
      s += 1;
    }
    if (row.has_checkin_photo) s += 1;
    return s;
  };
  return score(a) >= score(b) ? a : b;
}

function combineMachineDays(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const pickEarlier = (x, y) => {
    if (!isMeaningfulAttendancePunch(x)) return y || null;
    if (!isMeaningfulAttendancePunch(y)) return x;
    const dx = parseAttendanceDateTime(x);
    const dy = parseAttendanceDateTime(y);
    if (!dx) return y;
    if (!dy) return x;
    return dx.getTime() <= dy.getTime() ? x : y;
  };
  const pickLater = (x, y) => {
    if (!isMeaningfulAttendancePunch(x)) return y || null;
    if (!isMeaningfulAttendancePunch(y)) return x;
    const dx = parseAttendanceDateTime(x);
    const dy = parseAttendanceDateTime(y);
    if (!dx) return y;
    if (!dy) return x;
    return dx.getTime() >= dy.getTime() ? x : y;
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
    const aCrm = extractCrmPunchesFromAttendanceLogRow(prev);
    const bCrm = extractCrmPunchesFromAttendanceLogRow(row);
    const crmIn = pickEarlierCheckin(aCrm.checkin, bCrm.checkin).value;
    const crmOut = pickLaterCheckout(aCrm.checkout, bCrm.checkout).value;
    const shell = pickCrmShellForMerge(prev, row);
    const hasCrmShell = Boolean(shell && !shell._syntheticMachineOnly);
    const cleanCrm = {
      ...buildCrmBaseRowForRematch(shell),
      checkin_time: crmIn,
      checkout_time: crmOut,
      crm_checkin_time: crmIn,
      crm_checkout_time: crmOut,
      _syntheticMachineOnly: !hasCrmShell,
    };

    byKey.set(key, mergeCrmAndMachineDay(cleanCrm, machineDay));
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

/** Machine punches for selected user(s), not only codes seen on CRM rows in range. */
function buildMachineEmpCodes({
  rows,
  usernameToMachineCode,
  usernameAliases,
  usernameParam,
  activeEmployees,
  idsByUser,
  resolveCanon,
  canonicalMaps,
}) {
  const codes = new Set();
  for (const r of rows || []) {
    const c = String(r.machine_code || "").trim();
    if (c) codes.add(c);
  }

  const addCodeForCanonUser = (canon) => {
    if (!canon) return;
    const fromMap = usernameToMachineCode.get(canon);
    if (fromMap) codes.add(fromMap);
    const fromIds = idsByUser.get(canon)?.machine_code;
    if (fromIds) codes.add(String(fromIds).trim());
  };

  if (usernameParam && usernameAliases.length) {
    for (const alias of usernameAliases) {
      const preCanon = resolveCanon(alias, canonicalMaps);
      const ids = idsByUser.get(preCanon);
      const canon = resolveCanon(alias, canonicalMaps, {
        employee_id: ids?.employee_id,
        machine_code: ids?.machine_code,
      });
      addCodeForCanonUser(canon);
    }
    return [...codes];
  }

  for (const r of activeEmployees || []) {
    const c = String(r.machine_code || "").trim();
    if (c) codes.add(c);
  }
  for (const code of usernameToMachineCode.values()) {
    if (code) codes.add(String(code).trim());
  }
  return [...codes];
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

    // Collapse massive duplicate rows (same user+date repeated hundreds of times).
    // Earliest check-in + latest check-out across duplicates; sample row for address/breaks.
    const userLogSql = usernameAliases.length
      ? ` AND username IN (${usernameAliases.map(() => "?").join(", ")})`
      : "";
    const logParams = [queryFrom, queryTo, ...usernameAliases];

    const logSql = `
      SELECT
        agg.day_date AS date,
        agg.username,
        COALESCE(sample.employee_id, r.empId) AS employee_id,
        COALESCE(
          NULLIF(TRIM(sample.machine_code), ''),
          NULLIF(TRIM(r.machine_code), '')
        ) AS machine_code,
        sample.admin_time_edit_remark,
        agg.checkin_time,
        agg.checkout_time,
        sample.break_morning_start,
        sample.break_morning_end,
        sample.break_lunch_start,
        sample.break_lunch_end,
        sample.break_evening_start,
        sample.break_evening_end,
        sample.checkin_address,
        sample.checkin_latitude,
        sample.checkin_longitude,
        sample.checkout_address,
        sample.checkout_latitude,
        sample.checkout_longitude,
        agg.has_checkin_photo
      FROM (
        SELECT
          username,
          DATE(date) AS day_date,
          MIN(
            CASE
              WHEN checkin_time IS NOT NULL
               AND TRIM(CAST(checkin_time AS CHAR)) <> ''
               AND CAST(checkin_time AS CHAR) NOT LIKE '0000-00-00%'
              THEN checkin_time
            END
          ) AS checkin_time,
          MAX(
            CASE
              WHEN checkout_time IS NOT NULL
               AND TRIM(CAST(checkout_time AS CHAR)) <> ''
               AND CAST(checkout_time AS CHAR) NOT LIKE '0000-00-00%'
              THEN checkout_time
            END
          ) AS checkout_time,
          COALESCE(
            MIN(
              CASE
                WHEN checkin_address IS NOT NULL
                 AND TRIM(checkin_address) <> ''
                 AND LOWER(TRIM(checkin_address)) <> 'machine'
                THEN id
              END
            ),
            MIN(id)
          ) AS sample_id,
          MAX(
            CASE
              WHEN checkin_photo IS NOT NULL AND TRIM(checkin_photo) <> ''
              THEN 1 ELSE 0
            END
          ) AS has_checkin_photo
        FROM attendance_logs
        WHERE date >= ?
          AND date < DATE_ADD(?, INTERVAL 1 DAY)
          ${userLogSql}
        GROUP BY username, DATE(date)
      ) agg
      INNER JOIN attendance_logs sample ON sample.id = agg.sample_id
      LEFT JOIN rep_list r
        ON agg.username COLLATE utf8mb4_unicode_ci = r.username COLLATE utf8mb4_unicode_ci
       AND r.status = 1
      ORDER BY agg.day_date DESC`;

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

    const {
      usernameToMachineCode,
      machineCodeToUsername,
      canonicalMaps,
      resolveCanonicalUsername: resolveCanon,
    } = await loadMachineCodeMaps(db);

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
      const empCodes = buildMachineEmpCodes({
        rows,
        usernameToMachineCode,
        usernameAliases,
        usernameParam,
        activeEmployees,
        idsByUser,
        resolveCanon,
        canonicalMaps,
      });
      const machineOpts = {
        fromDate: queryFrom,
        toDate: queryTo,
      };
      if (empCodes.length) machineOpts.empCodes = empCodes;
      const machineByUserDate = await loadMachineDailyByUsername(
        db,
        machineCodeToUsername,
        machineOpts,
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
