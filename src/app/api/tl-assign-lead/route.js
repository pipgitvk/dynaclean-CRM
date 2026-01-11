import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// POST - Assign or Reassign lead to an employee
export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { customer_id, employee_username } = body;

    if (!customer_id || !employee_username) {
      return NextResponse.json(
        { error: "customer_id and employee_username are required" },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    // Update the customer's lead_source to the new employee
    await connection.execute(
      `UPDATE customers SET lead_source = ?, assigned_to = ?, sales_representative = ? WHERE customer_id = ?`,
      [employee_username, payload.username, employee_username, customer_id]
    );

    // Also update in TL_followups if exists
    await connection.execute(
      `UPDATE TL_followups SET assigned_employee = ? WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1`,
      [employee_username, customer_id]
    );

    return NextResponse.json({
      success: true,
      message: `Lead assigned to ${employee_username} successfully`
    });
  } catch (error) {
    console.error("Error assigning lead:", error);
    return NextResponse.json(
      { error: "Failed to assign lead" },
      { status: 500 }
    );
  }
}

// GET - Fetch list of sales employees for assignment
export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connection = await getDbConnection();

    // Fetch employees with SALES role or related roles
    const [employees] = await connection.execute(
      `SELECT username, username as name FROM rep_list WHERE status = 1 and userRole IN ('SALES', 'ADMIN', 'BACK OFFICE', 'SALES HEAD', 'GEM PORTAL') ORDER BY username`
    );

    return NextResponse.json({ success: true, employees });
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
}
