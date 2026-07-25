import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET: Fetch accruals for an employee
export async function GET(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    const conn = await getDbConnection();

    const query = `
      SELECT * FROM paid_leave_accrual
      WHERE username = ? AND status = 'active'
      ORDER BY accrual_date DESC
    `;

    const [accruals] = await conn.execute(query, [username]);

    return NextResponse.json({
      success: true,
      accruals
    });
  } catch (error) {
    console.error("Error fetching accruals:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST: Add paid leave accrual
export async function POST(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin/HR
    const isAdmin = ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"].includes(session.role);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Only HR can add paid leave accruals" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { username, accrualDate, totalDays, description, expiryDate } = body;

    if (!username || !accrualDate || !totalDays) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // Get employee empId
    const [empData] = await conn.execute(
      "SELECT empId FROM rep_list WHERE username = ?",
      [username]
    );

    if (!empData || empData.length === 0) {
      return NextResponse.json(
        { success: false, error: "Employee not found" },
        { status: 404 }
      );
    }

    const empId = empData[0].empId;

    // Insert accrual record
    const insertQuery = `
      INSERT INTO paid_leave_accrual 
      (username, empId, accrual_date, total_days, remaining_days, description, expiry_date, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `;

    const result = await conn.execute(insertQuery, [
      username,
      empId,
      accrualDate,
      totalDays,
      totalDays,
      description || null,
      expiryDate || null,
      session.username
    ]);

    return NextResponse.json({
      success: true,
      message: "Paid leave accrual added successfully",
      accrualId: result[0].insertId
    });
  } catch (error) {
    console.error("Error adding accrual:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PATCH: Update accrual or map leave usage
export async function PATCH(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const isAdmin = ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"].includes(session.role);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Only HR can modify accruals" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const conn = await getDbConnection();

    if (body.accrualId && body.remainingDays !== undefined) {
      // Update remaining days
      const query = `
        UPDATE paid_leave_accrual 
        SET remaining_days = ?
        WHERE id = ?
      `;
      await conn.execute(query, [body.remainingDays, body.accrualId]);

      return NextResponse.json({
        success: true,
        message: "Accrual updated"
      });
    }

    if (body.accrualId && body.leaveId && body.daysUsed) {
      // Map leave usage to accrual
      const mappingQuery = `
        INSERT INTO paid_leave_usage_mapping
        (accrual_id, leave_id, username, days_used, used_date)
        VALUES (?, ?, ?, ?, CURDATE())
      `;
      
      const leaveQuery = `
        SELECT username FROM employee_leaves WHERE id = ?
      `;
      
      const [leave] = await conn.execute(leaveQuery, [body.leaveId]);
      if (!leave || leave.length === 0) {
        return NextResponse.json(
          { success: false, error: "Leave not found" },
          { status: 404 }
        );
      }

      await conn.execute(mappingQuery, [
        body.accrualId,
        body.leaveId,
        leave[0].username,
        body.daysUsed
      ]);

      return NextResponse.json({
        success: true,
        message: "Leave usage mapped to accrual"
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating accrual:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
