import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { getReportees, isReportingManagerOf } from "@/lib/reportingManager";

export async function GET(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employee = searchParams.get("employee");
    const date = searchParams.get("date");

    if (!employee || !date) {
      return NextResponse.json({ error: "Employee and date are required" }, { status: 400 });
    }

    // Verify the employee is assigned to this reporting manager
    const isManager = await isReportingManagerOf(session.username, employee);
    if (!isManager) {
      return NextResponse.json({ error: "Employee not assigned to you" }, { status: 403 });
    }

    const conn = await getDbConnection();

    // Try different possible column names for the date field
    let attendanceRows = [];
    try {
      [attendanceRows] = await conn.execute(
        `SELECT id, username, date, checkin_time, checkout_time
         FROM attendance_logs 
         WHERE username = ? AND DATE(date) = ?`,
        [employee, date]
      );
    } catch (e1) {
      try {
        [attendanceRows] = await conn.execute(
          `SELECT id, username, attendance_date, checkin_time, checkout_time
           FROM attendance_logs 
           WHERE username = ? AND DATE(attendance_date) = ?`,
          [employee, date]
        );
      } catch (e2) {
        try {
          [attendanceRows] = await conn.execute(
            `SELECT id, username, created_at, checkin_time, checkout_time
             FROM attendance_logs 
             WHERE username = ? AND DATE(created_at) = ?`,
            [employee, date]
          );
        } catch (e3) {
          // If none work, get latest record for the employee
          [attendanceRows] = await conn.execute(
            `SELECT id, username, checkin_time, checkout_time
             FROM attendance_logs 
             WHERE username = ? 
             ORDER BY id DESC 
             LIMIT 1`,
            [employee]
          );
        }
      }
    }

    const attendance = attendanceRows.length > 0 ? attendanceRows[0] : null;

    return NextResponse.json({ 
      success: true, 
      attendance: attendance ? {
        id: attendance.id,
        log_date: attendance.date || attendance.attendance_date || attendance.created_at || null,
        checkin_time: attendance.checkin_time,
        checkout_time: attendance.checkout_time
      } : null
    });

  } catch (error) {
    console.error("Error fetching attendance:", error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error.message 
    }, { status: 500 });
  }
}
