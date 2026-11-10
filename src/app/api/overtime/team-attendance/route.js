import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { getReportees } from "@/lib/reportingManager";
import { getISTDateString, parseAttendanceDateTime } from "@/lib/istDateTime";
import { attendanceDateKey } from "@/lib/leaveDateRange";
import { normalizeUsernameKey } from "@/lib/attendanceCanonicalUsername";
import { isMeaningfulAttendancePunch } from "@/lib/attendanceMeaningfulPunch";
import {
  loadMachineCodeMaps,
  pickEarlierCheckin,
  pickLaterCheckout,
} from "@/lib/attendanceMachineMerge";
import { ensureMachineAttendancePunchesTable } from "@/lib/ensureMachineAttendancePunchesTable";
import { ensureRepListMachineCodeColumn } from "@/lib/ensureRepListMachineCode";

function shiftYmd(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return getISTDateString(dt);
}

function parseYmd(s) {
  const t = String(s || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

function pickEarlierTime(a, b) {
  if (!isMeaningfulAttendancePunch(a)) return b ?? null;
  if (!isMeaningfulAttendancePunch(b)) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

function pickLaterTime(a, b) {
  if (!isMeaningfulAttendancePunch(a)) return b ?? null;
  if (!isMeaningfulAttendancePunch(b)) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function machinePunchesSameInstant(a, b) {
  const d1 = parseAttendanceDateTime(a);
  const d2 = parseAttendanceDateTime(b);
  if (!d1 || !d2) return false;
  return d1.getTime() === d2.getTime();
}

/** Checkout from machine only when there were 2+ distinct punches that day. */
function machineCheckoutForDay(machineDay) {
  if (!machineDay) return null;
  const punchCount = Number(machineDay.punch_count ?? 0);
  const out = machineDay.machine_checkout;
  if (!isMeaningfulAttendancePunch(out)) return null;
  if (punchCount <= 1) return null;
  if (machinePunchesSameInstant(machineDay.machine_checkin, out)) return null;
  return out;
}

function rowToAttendanceFields(row) {
  return {
    id: row.id,
    checkin_time: row.checkin_time,
    checkout_time: row.checkout_time,
    checkin_address: row.checkin_address,
    checkout_address: row.checkout_address,
    checkin_photo: row.checkin_photo,
    break_morning_start: row.break_morning_start,
    break_morning_end: row.break_morning_end,
    break_lunch_start: row.break_lunch_start,
    break_lunch_end: row.break_lunch_end,
    break_evening_start: row.break_evening_start,
    break_evening_end: row.break_evening_end,
    working_hours: null,
    from_machine: false,
  };
}

function mergeAttendanceDayEntry(prev, row) {
  if (!prev) return rowToAttendanceFields(row);
  return {
    ...prev,
    id: prev.id ?? row.id,
    checkin_time: pickEarlierTime(prev.checkin_time, row.checkin_time),
    checkout_time: pickLaterTime(prev.checkout_time, row.checkout_time),
    checkin_address: prev.checkin_address || row.checkin_address,
    checkout_address: prev.checkout_address || row.checkout_address,
    checkin_photo: prev.checkin_photo || row.checkin_photo,
    break_morning_start: prev.break_morning_start || row.break_morning_start,
    break_morning_end: prev.break_morning_end || row.break_morning_end,
    break_lunch_start: prev.break_lunch_start || row.break_lunch_start,
    break_lunch_end: prev.break_lunch_end || row.break_lunch_end,
    break_evening_start: prev.break_evening_start || row.break_evening_start,
    break_evening_end: prev.break_evening_end || row.break_evening_end,
  };
}

async function loadMachineByUserDate(conn, reportees, fromYmd, toYmd, machineMaps) {
  await ensureMachineAttendancePunchesTable(conn);
  const codes = new Set();
  for (const username of reportees) {
    const canon = machineMaps.resolveCanonicalUsername(username);
    const code =
      machineMaps.usernameToMachineCode.get(canon) ||
      machineMaps.usernameToMachineCode.get(normalizeUsernameKey(username));
    if (code) codes.add(String(code).trim());
  }
  if (!codes.size) return new Map();

  const codeList = [...codes];
  const ph = codeList.map(() => "?").join(", ");
  const [rows] = await conn.execute(
    `SELECT
       emp_code,
       DATE(punch_datetime) AS punch_date,
       MIN(punch_datetime) AS machine_checkin,
       MAX(punch_datetime) AS machine_checkout,
       COUNT(*) AS punch_count,
       GROUP_CONCAT(
         punch_datetime
         ORDER BY punch_datetime ASC
         SEPARATOR '||'
       ) AS all_punch_datetimes
     FROM machine_attendance_punches
     WHERE emp_code IN (${ph})
       AND punch_datetime >= ?
       AND punch_datetime < DATE_ADD(?, INTERVAL 1 DAY)
     GROUP BY emp_code, DATE(punch_datetime)`,
  [
      ...codeList,
      `${fromYmd} 00:00:00`,
      toYmd,
    ],
  );

  const map = new Map();
  for (const row of rows || []) {
    const code = String(row.emp_code || "").trim();
    const username = machineMaps.machineCodeToUsername.get(code);
    if (!username) continue;
    const dateYmd = attendanceDateKey(row.punch_date);
    if (!dateYmd) continue;
    const punchCount = Number(row.punch_count ?? 0);
    const allRaw = String(row.all_punch_datetimes || "")
      .split("||")
      .map((s) => s.trim())
      .filter(Boolean);
    map.set(`${normalizeUsernameKey(username)}|${dateYmd}`, {
      machine_checkin: row.machine_checkin,
      machine_checkout: row.machine_checkout,
      punch_count: punchCount,
      all_punch_datetimes: allRaw,
    });
  }
  return map;
}

function emptyTeamAttendanceRow() {
  return {
    id: null,
    checkin_time: null,
    checkout_time: null,
    checkin_address: null,
    checkout_address: null,
    checkin_photo: null,
    break_morning_start: null,
    break_morning_end: null,
    break_lunch_start: null,
    break_lunch_end: null,
    break_evening_start: null,
    break_evening_end: null,
    working_hours: null,
    machine_punch_count: 0,
    from_machine: false,
  };
}

/** Same rules as machine-attendance daily: first punch = in, last = out (only if 2+ punches). */
function applyMachineToAttendance(att, machineDay) {
  if (!machineDay) return att;
  const next = att ? { ...att } : emptyTeamAttendanceRow();
  const punchCount = Number(machineDay.punch_count ?? 0);
  const machineIn = machineDay.machine_checkin;
  const machineOut = machineCheckoutForDay(machineDay);

  let touched = false;
  let usedMachine = false;

  const checkInPick = pickEarlierCheckin(
    isMeaningfulAttendancePunch(next.checkin_time) ? next.checkin_time : null,
    isMeaningfulAttendancePunch(machineIn) ? machineIn : null,
  );
  if (isMeaningfulAttendancePunch(checkInPick.value)) {
    const prevMs = parseAttendanceDateTime(next.checkin_time)?.getTime() ?? null;
    const nextMs =
      parseAttendanceDateTime(checkInPick.value)?.getTime() ?? null;
    if (prevMs !== nextMs) {
      next.checkin_time = checkInPick.value;
      if (checkInPick.source === "machine") {
        touched = true;
        usedMachine = true;
      }
    }
  }

  if (punchCount > 1 && isMeaningfulAttendancePunch(machineOut)) {
    const checkoutPick = pickLaterCheckout(
      isMeaningfulAttendancePunch(next.checkout_time)
        ? next.checkout_time
        : null,
      machineOut,
    );
    if (isMeaningfulAttendancePunch(checkoutPick.value)) {
      const prevMs =
        parseAttendanceDateTime(next.checkout_time)?.getTime() ?? null;
      const nextMs =
        parseAttendanceDateTime(checkoutPick.value)?.getTime() ?? null;
      if (prevMs !== nextMs) {
        next.checkout_time = checkoutPick.value;
        if (checkoutPick.source === "machine") {
          touched = true;
          usedMachine = true;
        }
      }
    }
  }

  if (punchCount > 0) next.machine_punch_count = punchCount;
  if (usedMachine) next.from_machine = true;

  return touched || att ? next : null;
}

export async function GET(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const daysBack = Math.max(
      1,
      parseInt(searchParams.get("daysBack") || "30", 10),
    );
    const fromParam = parseYmd(searchParams.get("from"));
    const toParam = parseYmd(searchParams.get("to"));

    const todayYmd = getISTDateString();
    const toYmd = toParam && toParam <= todayYmd ? toParam : todayYmd;
    const fromYmd =
      fromParam && fromParam <= toYmd
        ? fromParam
        : shiftYmd(toYmd, -Math.max(0, daysBack - 1));

    const conn = await getDbConnection();
    await ensureRepListMachineCodeColumn(conn);

    const reportees = await getReportees(session.username);

    if (reportees.length === 0) {
      return NextResponse.json({
        success: true,
        attendanceByDate: {},
        datesSorted: [],
        from: fromYmd,
        to: toYmd,
      });
    }

    const ph = reportees.map(() => "?").join(", ");
    const [employeeRows] = await conn.execute(
      `SELECT username, empId, userRole, status, machine_code
       FROM rep_list
       WHERE username IN (${ph})
       ORDER BY username`,
      reportees,
    );

    const [attendanceRows] = await conn.execute(
      `SELECT id, username, date, checkin_time, checkout_time, checkin_address, checkout_address,
              checkin_photo,
              break_morning_start, break_morning_end, break_lunch_start, break_lunch_end,
              break_evening_start, break_evening_end
       FROM attendance_logs
       WHERE username IN (${ph})
         AND date >= ?
         AND date <= ?
       ORDER BY date DESC, id DESC`,
      [...reportees, fromYmd, toYmd],
    );

    const attendanceByDate = {};

    for (const row of attendanceRows || []) {
      const dateStr = attendanceDateKey(row.date);
      if (!dateStr) continue;
      const userKey = normalizeUsernameKey(row.username);
      if (!attendanceByDate[dateStr]) attendanceByDate[dateStr] = {};
      attendanceByDate[dateStr][userKey] = mergeAttendanceDayEntry(
        attendanceByDate[dateStr][userKey],
        row,
      );
    }

    const regularizationByDate = {};
    try {
      const [regularizationRows] = await conn.execute(
        `SELECT username, status, proposed_checkin_time, proposed_checkout_time, reviewer_comment, log_date
         FROM attendance_regularization_requests
         WHERE username IN (${ph}) AND log_date >= ? AND log_date <= ?
         ORDER BY log_date DESC, created_at DESC`,
        [...reportees, fromYmd, toYmd],
      );

      for (const row of regularizationRows || []) {
        const dateStr = attendanceDateKey(row.log_date);
        if (!dateStr) continue;
        const userKey = normalizeUsernameKey(row.username);
        if (!regularizationByDate[dateStr]) regularizationByDate[dateStr] = {};
        if (!regularizationByDate[dateStr][userKey]) {
          regularizationByDate[dateStr][userKey] = {
            status: row.status,
            proposed_checkin_time: row.proposed_checkin_time,
            proposed_checkout_time: row.proposed_checkout_time,
            reviewer_comment: row.reviewer_comment,
          };
        }
      }
    } catch (error) {
      console.error("regularization fetch:", error.message);
    }

    const machineMaps = await loadMachineCodeMaps(conn);
    const machineByUserDate = await loadMachineByUserDate(
      conn,
      reportees,
      fromYmd,
      toYmd,
      machineMaps,
    );

    const dateKeySet = new Set(Object.keys(attendanceByDate));
    for (const key of machineByUserDate.keys()) {
      const pipe = key.indexOf("|");
      if (pipe >= 0) dateKeySet.add(key.slice(pipe + 1));
    }
    if (toYmd >= fromYmd) {
      dateKeySet.add(toYmd);
    }

    const datesSorted = [...dateKeySet]
      .filter((d) => d >= fromYmd && d <= toYmd)
      .sort()
      .reverse();

    const employeesByDateAndUsername = {};

    datesSorted.forEach((date) => {
      employeesByDateAndUsername[date] = employeeRows.map((emp) => {
        const userKey = normalizeUsernameKey(emp.username);
        const canon = machineMaps.resolveCanonicalUsername(emp.username, {
          employee_id: emp.empId,
          machine_code: emp.machine_code,
        });
        const machineKey = `${normalizeUsernameKey(canon)}|${date}`;
        const machineDay =
          machineByUserDate.get(machineKey) ||
          machineByUserDate.get(`${userKey}|${date}`);

        let attendance = attendanceByDate[date]?.[userKey] || null;
        attendance = applyMachineToAttendance(attendance, machineDay);
        if (
          attendance &&
          isMeaningfulAttendancePunch(attendance.checkin_time) &&
          isMeaningfulAttendancePunch(attendance.checkout_time) &&
          machinePunchesSameInstant(
            attendance.checkin_time,
            attendance.checkout_time,
          )
        ) {
          attendance = { ...attendance, checkout_time: null };
        }
        if (
          !attendance ||
          (!isMeaningfulAttendancePunch(attendance.checkin_time) &&
            !isMeaningfulAttendancePunch(attendance.checkout_time))
        ) {
          attendance = null;
        }

        return {
          username: emp.username,
          empId: emp.empId,
          userRole: emp.userRole,
          status: emp.status,
          attendance,
          regularization: regularizationByDate[date]?.[userKey] || null,
        };
      });
    });

    return NextResponse.json({
      success: true,
      attendanceByDate: employeesByDateAndUsername,
      datesSorted,
      from: fromYmd,
      to: toYmd,
      daysBack,
    });
  } catch (error) {
    console.error("Team attendance API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
