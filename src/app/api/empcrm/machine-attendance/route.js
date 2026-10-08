import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { ensureMachineAttendancePunchesTable } from "@/lib/ensureMachineAttendancePunchesTable";
import { requireMachineAttendanceSession } from "@/lib/empcrmMachineAttendanceAuth";
import {
  getLastMachineAttendanceSync,
  syncMachineAttendanceFromEtimeOffice,
} from "@/lib/syncMachineAttendance";

export const dynamic = "force-dynamic";

let machineAttendanceCronStarted = false;
if (!machineAttendanceCronStarted) {
  machineAttendanceCronStarted = true;
  import("@/lib/cron/machineAttendanceSyncCron").then((mod) => {
    mod.startMachineAttendanceSyncCron();
  });
}

function parseYmd(s) {
  const t = String(s || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

function buildMachinePunchFilters(from, to, employeeSearch) {
  const where = [];
  const params = [];
  if (from) {
    where.push("punch_datetime >= ?");
    params.push(`${from} 00:00:00`);
  }
  if (to) {
    where.push("punch_datetime <= ?");
    params.push(`${to} 23:59:59`);
  }
  const term = String(employeeSearch || "").trim();
  if (term && term.toUpperCase() !== "ALL") {
    where.push("(emp_code = ? OR employee_name LIKE ?)");
    params.push(term, `%${term}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return { whereSql, params };
}

/** GET — daily summary (default) or raw punches (?view=raw). */
export async function GET(request) {
  try {
    const auth = await requireMachineAttendanceSession();
    if (!auth.ok) {
      return NextResponse.json({ message: auth.message }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const from = parseYmd(searchParams.get("from"));
    const to = parseYmd(searchParams.get("to"));
    const employeeSearch =
      searchParams.get("search")?.trim() ||
      searchParams.get("empcode")?.trim() ||
      "";
    const view = String(searchParams.get("view") || "daily").toLowerCase();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10))
    );
    const offset = (page - 1) * limit;

    const conn = await getDbConnection();
    await ensureMachineAttendancePunchesTable(conn);

    const lastSync = await getLastMachineAttendanceSync(conn);
    const { whereSql, params } = buildMachinePunchFilters(from, to, employeeSearch);

    if (view === "raw") {
      const [countRows] = await conn.execute(
        `SELECT COUNT(*) AS total FROM machine_attendance_punches ${whereSql}`,
        params
      );
      const total = Number(countRows[0]?.total ?? 0);

      const [rows] = await conn.execute(
        `SELECT id, emp_code, employee_name, punch_datetime, m_flag, raw_punch_date, synced_at
         FROM machine_attendance_punches
         ${whereSql}
         ORDER BY punch_datetime DESC, id DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params
      );

      return NextResponse.json({
        view: "raw",
        rows: rows || [],
        lastSync,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
      });
    }

    const [countRows] = await conn.execute(
      `SELECT COUNT(*) AS total FROM (
         SELECT 1
         FROM machine_attendance_punches
         ${whereSql}
         GROUP BY emp_code, DATE(punch_datetime)
       ) grouped`,
      params
    );
    const total = Number(countRows[0]?.total ?? 0);

    const [rows] = await conn.execute(
      `SELECT
         emp_code,
         MAX(employee_name) AS employee_name,
         DATE(punch_datetime) AS punch_date,
         GROUP_CONCAT(
           CASE
             WHEN HOUR(punch_datetime) < 12
             THEN LOWER(TIME_FORMAT(punch_datetime, '%h:%i %p'))
           END
           ORDER BY punch_datetime
           SEPARATOR ', '
         ) AS check_in_times,
         GROUP_CONCAT(
           CASE
             WHEN HOUR(punch_datetime) >= 12
             THEN LOWER(TIME_FORMAT(punch_datetime, '%h:%i %p'))
           END
           ORDER BY punch_datetime
           SEPARATOR ', '
         ) AS check_out_times,
         COUNT(*) AS punch_count
       FROM machine_attendance_punches
       ${whereSql}
       GROUP BY emp_code, DATE(punch_datetime)
       ORDER BY punch_date DESC, emp_code ASC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const normalized = (rows || []).map((row) => ({
      emp_code: row.emp_code,
      employee_name: row.employee_name,
      punch_date: row.punch_date,
      check_in: row.check_in_times ? String(row.check_in_times).trim() : "",
      check_out: row.check_out_times ? String(row.check_out_times).trim() : "",
      punch_count: Number(row.punch_count ?? 0),
    }));

    return NextResponse.json({
      view: "daily",
      rows: normalized,
      lastSync,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    console.error("machine-attendance GET:", err);
    return NextResponse.json(
      { message: err.message || "Server error" },
      { status: 500 }
    );
  }
}

/**
 * POST — sync from eTimeOffice into DB.
 * Body: { from: "YYYY-MM-DD", to: "YYYY-MM-DD", empCode?: "ALL", dayStart?: "09:30", dayEnd?: "18:30" }
 */
export async function POST(request) {
  try {
    const auth = await requireMachineAttendanceSession();
    if (!auth.ok) {
      return NextResponse.json({ message: auth.message }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const from = parseYmd(body.from);
    const to = parseYmd(body.to);
    if (!from || !to) {
      return NextResponse.json(
        { message: "from and to (YYYY-MM-DD) are required." },
        { status: 400 }
      );
    }
    if (from > to) {
      return NextResponse.json(
        { message: "from date must be on or before to date." },
        { status: 400 }
      );
    }

    const empCode = String(body.empCode ?? body.empcode ?? "ALL").trim() || "ALL";
    const dayStart = String(body.dayStart ?? "09:30").trim();
    const dayEnd = String(body.dayEnd ?? "18:30").trim();
    const syncedBy =
      auth.payload.username ||
      auth.payload.name ||
      auth.payload.email ||
      "unknown";

    const result = await syncMachineAttendanceFromEtimeOffice({
      from,
      to,
      empCode,
      dayStart,
      dayEnd,
      source: "manual",
      syncedBy,
    });

    return NextResponse.json({
      success: true,
      ...result,
      syncedBy,
    });
  } catch (err) {
    console.error("machine-attendance POST:", err);
    return NextResponse.json(
      { message: err.message || "Sync failed" },
      { status: 500 }
    );
  }
}
