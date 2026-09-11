import { NextResponse } from "next/server";

import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { userHasModuleKey } from "@/lib/userModuleAccessServer";

// POST: Add paid leave for employee (with add-paid-leaves module access)
export async function POST(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check module access for add-paid-leaves
    const hasAccess = await userHasModuleKey(session.username, session.role, "add-paid-leaves");
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Access denied. You don't have permission to add paid leaves." },
        { status: 403 }
      );
    }

    const body = await request.json();
    let { username, from_date, to_date, reason, is_half_day = false, half_day_type = null, has_time_range = false, start_time = null, end_time = null, start_date_time, end_date_time } = body;

    // If combined datetime strings provided (e.g. "2026-09-10T14:30"), prefer them.
    if (start_date_time) {
      const m = String(start_date_time).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})/);
      if (m) {
        if (!from_date || has_time_range) from_date = m[1];
        start_time = m[2];
        has_time_range = true;
      }
    }
    if (end_date_time) {
      const m = String(end_date_time).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})/);
      if (m) {
        if (!to_date || has_time_range) to_date = m[1];
        end_time = m[2];
        has_time_range = true;
      }
    }

    if (!username || !from_date || !to_date || !reason) {
      return NextResponse.json(
        { success: false, error: "Employee, dates, and reason are required" },
        { status: 400 }
      );
    }

    if (has_time_range) {
      if (!start_time || !end_time) {
        return NextResponse.json(
          { success: false, error: "Start time and End time are required when time range is enabled" },
          { status: 400 }
        );
      }
      if (start_time >= end_time) {
        return NextResponse.json(
          { success: false, error: "Start time must be before End time" },
          { status: 400 }
        );
      }
    }

    const conn = await getDbConnection();

    // Auto-migration: Add created_by column if not exists
    try {
      await conn.execute(`ALTER TABLE employee_leaves ADD COLUMN created_by varchar(255) DEFAULT NULL COMMENT 'Username of superadmin/HR who created this leave record'`);
    } catch (e) { /* ignore - already applied */ }

    // Auto-migration: Ensure half-day enum value exists
    try {
      await conn.execute(`ALTER TABLE employee_leaves MODIFY COLUMN leave_type enum('sick','paid','casual','unpaid','half-day') NOT NULL`);
    } catch (e) { /* ignore */ }

    // Auto-migration: Add start_time and end_time columns if not exists
    try {
      await conn.execute(`ALTER TABLE employee_leaves ADD COLUMN start_time time DEFAULT NULL COMMENT 'Leave start time of day (HH:MM)'`);
    } catch (e) { /* ignore */ }
    try {
      await conn.execute(`ALTER TABLE employee_leaves ADD COLUMN end_time time DEFAULT NULL COMMENT 'Leave end time of day (HH:MM)'`);
    } catch (e) { /* ignore */ }

    // Fetch employee to verify existence and get empId
    const [empRows] = await conn.execute(`SELECT empId, username FROM rep_list WHERE username = ? LIMIT 1`, [username]);
    if (empRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Employee not found" },
        { status: 404 }
      );
    }

    const employee = empRows[0];
    const empId = employee.empId;
    let totalDays = 0;

    if (is_half_day) {
      totalDays = 0.5;
    } else {
      const fromDate = new Date(from_date);
      const toDate = new Date(to_date);
      totalDays = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;
    }

    const finalStartTime = has_time_range ? start_time : null;
    const finalEndTime = has_time_range ? end_time : null;

    // Insert leave record with created_by set to current user
    // Status is set to 'pending' - needs superadmin approval
    const [insertResult] = await conn.execute(
      `INSERT INTO employee_leaves 
       (empId, username, leave_type, from_date, to_date, start_time, end_time, total_days, reason, status, is_half_day, half_day_type, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empId,
        username,
        'paid',
        from_date,
        to_date,
        finalStartTime,
        finalEndTime,
        totalDays,
        reason,
        'pending',
        is_half_day ? 1 : 0,
        is_half_day ? half_day_type : null,
        session.username
      ]
    );

    if (conn.release) conn.release();

    return NextResponse.json({
      success: true,
      message: "Paid leave request submitted for approval",
      leaveId: insertResult.insertId,
      leave: {
        id: insertResult.insertId,
        username,
        leave_type: 'paid',
        from_date,
        to_date,
        start_time: finalStartTime,
        end_time: finalEndTime,
        total_days: totalDays,
        reason,
        status: 'pending',
        created_by: session.username
      }
    });
  } catch (error) {
    console.error("Error adding paid leave:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add paid leave: " + error.message },
      { status: 500 }
    );
  }
}

// GET: Fetch paid leaves added by superadmin
export async function GET(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check module access for add-paid-leaves
    const hasAccess = await userHasModuleKey(session.username, session.role, "add-paid-leaves");
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const conn = await getDbConnection();

    // Fetch leaves created by superadmin
    const [leaves] = await conn.execute(
      `SELECT * FROM employee_leaves WHERE created_by IS NOT NULL ORDER BY created_at DESC LIMIT 100`
    );

    if (conn.release) conn.release();

    return NextResponse.json({
      success: true,
      leaves
    });
  } catch (error) {
    console.error("Error fetching paid leaves:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch leaves" },
      { status: 500 }
    );
  }
}
