// app/api/empcrm/attendance/fetch/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { applyAutomaticCheckouts } from "@/lib/attendanceAutoCheckout";
import { ensureAttendanceAutoCheckoutApprovalsTable } from "@/lib/ensureAttendanceAutoCheckoutApprovalsTable";
import {
  loadMachineCodeMaps,
  loadMachineDailyByUsername,
  mergeAttendanceListWithMachine,
} from "@/lib/attendanceMachineMerge";

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    let username = "Unknown";
    const payload = await getSessionPayload();
    if (!payload) {
      console.log("Error: No session payload found. Unauthorized access attempt.");
      return NextResponse.json(
        { message: "Unauthorized access." },
        { status: 401 }
      );
    }
    username = payload.username;

    const db = await getDbConnection();
    await applyAutomaticCheckouts(db, { username });
    await ensureAttendanceAutoCheckoutApprovalsTable(db);

    const [rows] = await db.query(
      `SELECT
        a.username,
        a.date,
        a.checkin_time,
        a.checkout_time,
        a.checkin_address,
        a.checkout_address,
        a.checkin_latitude,
        a.checkin_longitude,
        a.checkout_latitude,
        a.checkout_longitude,
        a.break_morning_start,
        a.break_morning_end,
        a.break_lunch_start,
        a.break_lunch_end,
        a.break_evening_start,
        a.break_evening_end,
        a.checkin_photo,
        ap.status AS auto_checkout_approval_status
      FROM attendance_logs a
      LEFT JOIN attendance_auto_checkout_approvals ap
        ON ap.username = a.username AND ap.log_date = a.date
      WHERE a.username = ?
      ORDER BY a.date DESC`,
      [username]
    );

    const { machineCodeToUsername } = await loadMachineCodeMaps(db);
    const machineByUserDate = await loadMachineDailyByUsername(
      db,
      machineCodeToUsername,
    );
    const mergedRows = mergeAttendanceListWithMachine(rows, machineByUserDate);

    const [holidays] = await db.query(
      `SELECT holiday_date, title, description
       FROM holidays
       ORDER BY holiday_date DESC`
    );

    // Fetch approved leaves for the user
    const [leaves] = await db.query(
      `SELECT username, from_date, to_date, leave_type, reason, is_half_day, half_day_type, start_time, end_time
       FROM employee_leaves
       WHERE username = ?
       AND status = 'approved'
       ORDER BY from_date DESC`,
      [username]
    );

    return NextResponse.json({
      username,
      attendance: mergedRows,
      holidays,
      leaves,
    });
  } catch (error) {
    console.error("Error fetching attendance logs:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}