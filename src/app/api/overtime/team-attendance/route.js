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
    const daysBack = parseInt(searchParams.get("daysBack") || "30", 10); // Get last 30 days by default

    const conn = await getDbConnection();

    // First get assigned employees
    const reportees = await getReportees(session.username);
    console.log("Team attendance for", session.username, "reportees:", reportees);

    if (reportees.length === 0) {
      return NextResponse.json({ 
        success: true, 
        attendanceByDate: {},
        datesSorted: []
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

    // Get attendance data for last N days
    const attendanceByDate = {}; // { "2024-07-13": { "username": { attendance, regularization } } }
    let attendanceRows = [];
    
    try {
      [attendanceRows] = await conn.execute(
        `SELECT id, username, date, checkin_time, checkout_time, checkin_address, checkout_address,
                checkin_photo,
                break_morning_start, break_morning_end, break_lunch_start, break_lunch_end,
                break_evening_start, break_evening_end
         FROM attendance_logs 
         WHERE username IN (${ph}) AND DATE(date) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         ORDER BY date DESC`,
        [...reportees, daysBack]
      );
    } catch (e1) {
      try {
        [attendanceRows] = await conn.execute(
          `SELECT id, username, attendance_date, checkin_time, checkout_time, checkin_address, checkout_address,
                  checkin_photo,
                  break_morning_start, break_morning_end, break_lunch_start, break_lunch_end,
                  break_evening_start, break_evening_end
           FROM attendance_logs 
           WHERE username IN (${ph}) AND DATE(attendance_date) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
           ORDER BY attendance_date DESC`,
          [...reportees, daysBack]
        );
      } catch (e2) {
        try {
          [attendanceRows] = await conn.execute(
            `SELECT id, username, created_at, checkin_time, checkout_time, checkin_address, checkout_address,
                    checkin_photo,
                    break_morning_start, break_morning_end, break_lunch_start, break_lunch_end,
                    break_evening_start, break_evening_end
             FROM attendance_logs 
             WHERE username IN (${ph}) AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             ORDER BY created_at DESC`,
            [...reportees, daysBack]
          );
        } catch (e3) {
          // If none work, get all records for the employees
          [attendanceRows] = await conn.execute(
            `SELECT id, username, checkin_time, checkout_time, checkin_address, checkout_address,
                    checkin_photo,
                    break_morning_start, break_morning_end, break_lunch_start, break_lunch_end,
                    break_evening_start, break_evening_end
             FROM attendance_logs 
             WHERE username IN (${ph})
             ORDER BY id DESC`,
            reportees
          );
        }
      }
    }
    
    // Organize attendance by date
    attendanceRows.forEach(row => {
      const logDate = row.date || row.attendance_date || row.created_at;
      let dateStr = null;
      
      if (logDate) {
        // Handle both Date objects and string formats
        if (typeof logDate === 'string') {
          dateStr = logDate.split('T')[0]; // Already a string, just extract date part
        } else if (logDate instanceof Date) {
          dateStr = logDate.toISOString().split('T')[0];
        } else if (typeof logDate === 'object') {
          // It's a Date object from mysql2
          dateStr = new Date(logDate).toISOString().split('T')[0];
        }
      }
      
      if (!dateStr) return;
      
      if (!attendanceByDate[dateStr]) {
        attendanceByDate[dateStr] = {};
      }
      
      attendanceByDate[dateStr][row.username] = {
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
        working_hours: null
      };
    });

    // Get all regularization requests (pending, approved, rejected) - last N days
    const regularizationByDate = {}; // { "2024-07-13": { "username": {...} } }
    try {
      const [regularizationRows] = await conn.execute(
        `SELECT username, status, proposed_checkin_time, proposed_checkout_time, reviewer_comment, log_date
         FROM attendance_regularization_requests 
         WHERE username IN (${ph}) AND DATE(log_date) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         ORDER BY log_date DESC, created_at DESC`,
        [...reportees, daysBack]
      );
      
      regularizationRows.forEach(row => {
        let dateStr = null;
        
        if (row.log_date) {
          // Handle both Date objects and string formats
          if (typeof row.log_date === 'string') {
            dateStr = row.log_date.split('T')[0];
          } else if (row.log_date instanceof Date) {
            dateStr = row.log_date.toISOString().split('T')[0];
          } else if (typeof row.log_date === 'object') {
            dateStr = new Date(row.log_date).toISOString().split('T')[0];
          }
        }
        
        if (!dateStr) return;
        
        if (!regularizationByDate[dateStr]) {
          regularizationByDate[dateStr] = {};
        }
        
        // Keep only the latest regularization per date per user
        if (!regularizationByDate[dateStr][row.username]) {
          regularizationByDate[dateStr][row.username] = {
            status: row.status,
            proposed_checkin_time: row.proposed_checkin_time,
            proposed_checkout_time: row.proposed_checkout_time,
            reviewer_comment: row.reviewer_comment
          };
        }
      });
    } catch (error) {
      console.log("Error fetching regularization data:", error);
    }

    // Combine all data organized by date (newest first)
    const datesSorted = Object.keys(attendanceByDate).sort().reverse();
    
    const employeesByDateAndUsername = {};
    
    datesSorted.forEach(date => {
      employeesByDateAndUsername[date] = employeeRows.map(emp => ({
        username: emp.username,
        empId: emp.empId,
        userRole: emp.userRole,
        status: emp.status,
        attendance: attendanceByDate[date]?.[emp.username] || null,
        regularization: regularizationByDate[date]?.[emp.username] || null
      }));
    });

    return NextResponse.json({ 
      success: true, 
      attendanceByDate: employeesByDateAndUsername,
      datesSorted,
      daysBack
    });
  } catch (error) {
    console.error("Team attendance API error:", error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error.message 
    }, { status: 500 });
  }
}
