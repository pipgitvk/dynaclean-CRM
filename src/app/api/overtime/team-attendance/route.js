import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { getReportees } from "@/lib/reportingManager";

export async function GET(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    const conn = await getDbConnection();

    // First get assigned employees
    const reportees = await getReportees(session.username);
    console.log("Team attendance for", session.username, "reportees:", reportees);

    if (reportees.length === 0) {
      return NextResponse.json({ 
        success: true, 
        employees: [],
        date: date || new Date().toISOString().split('T')[0]
      });
    }

    const ph = reportees.map(() => "?").join(", ");
    const [employeeRows] = await conn.execute(
      `SELECT username, empId, userRole, status 
       FROM rep_list 
       WHERE username IN (${ph}) 
       ORDER BY username`,
      reportees
    );

    // Then get attendance data separately
    const attendanceData = new Map();
    if (date) {
      // Try different possible column names for the date field
      let attendanceRows = [];
      try {
        [attendanceRows] = await conn.execute(
          `SELECT id, username, date, checkin_time, checkout_time
           FROM attendance_logs 
           WHERE username IN (${ph}) AND DATE(date) = ?`,
          [...reportees, date]
        );
      } catch (e1) {
        try {
          [attendanceRows] = await conn.execute(
            `SELECT id, username, attendance_date, checkin_time, checkout_time
             FROM attendance_logs 
             WHERE username IN (${ph}) AND DATE(attendance_date) = ?`,
            [...reportees, date]
          );
        } catch (e2) {
          try {
            [attendanceRows] = await conn.execute(
              `SELECT id, username, created_at, checkin_time, checkout_time
               FROM attendance_logs 
               WHERE username IN (${ph}) AND DATE(created_at) = ?`,
              [...reportees, date]
            );
          } catch (e3) {
            // If none work, get all records for the employees
            [attendanceRows] = await conn.execute(
              `SELECT id, username, checkin_time, checkout_time
               FROM attendance_logs 
               WHERE username IN (${ph})`,
              reportees
            );
          }
        }
      }
      
      attendanceRows.forEach(row => {
        attendanceData.set(row.username, {
          id: row.id,
          log_date: row.date || row.attendance_date || row.created_at || null,
          checkin_time: row.checkin_time,
          checkout_time: row.checkout_time,
          working_hours: null // Will be calculated or shown as N/A
        });
      });
    }

    // Get all regularization requests (pending, approved, rejected)
    const regularizationData = new Map();
    try {
      const [regularizationRows] = await conn.execute(
        `SELECT username, status, proposed_checkin_time, proposed_checkout_time, reviewer_comment
         FROM attendance_regularization_requests 
         WHERE username IN (${ph}) AND DATE(log_date) = ? 
         ORDER BY created_at DESC`,
        [...reportees, date]
      );
      
      regularizationRows.forEach(row => {
        regularizationData.set(row.username, {
          status: row.status,
          proposed_checkin_time: row.proposed_checkin_time,
          proposed_checkout_time: row.proposed_checkout_time,
          reviewer_comment: row.reviewer_comment
        });
      });
    } catch (error) {
      console.log("Error fetching regularization data:", error);
      // Continue without regularization data
    }

    // Combine employee and attendance data
    const employees = employeeRows.map(emp => ({
      username: emp.username,
      empId: emp.empId,
      userRole: emp.userRole,
      status: emp.status,
      attendance: attendanceData.get(emp.username) || null,
      regularization: regularizationData.get(emp.username) || null
    }));

    return NextResponse.json({ 
      success: true, 
      employees,
      date: date || new Date().toISOString().split('T')[0]
    });
  } catch (error) {
    console.error("Team attendance API error:", error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error.message 
    }, { status: 500 });
  }
}
