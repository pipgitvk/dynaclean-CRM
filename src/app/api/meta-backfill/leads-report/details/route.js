/**
 * GET /api/meta-backfill/leads-report/details?from=YYYY-MM-DD&to=YYYY-MM-DD&employee=...
 * Lists customers (leads) counted for that employee in leads-report, same CASE as aggregate.
 */
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { NextResponse } from "next/server";

const EMPLOYEE_CASE = `CASE 
  WHEN assigned_to IS NULL OR assigned_to = '' OR assigned_to = 'Automatic' 
  THEN COALESCE(lead_source, sales_representative, 'Unassigned')
  ELSE assigned_to 
END`;

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = payload.role?.toUpperCase() || "";
    if (!["ADMIN", "SUPERADMIN"].includes(role)) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const employee = searchParams.get("employee");

    if (!from || !to) {
      return NextResponse.json(
        { error: "Both 'from' and 'to' date (YYYY-MM-DD) are required" },
        { status: 400 }
      );
    }
    if (employee == null || String(employee).trim() === "") {
      return NextResponse.json({ error: "Parameter 'employee' is required" }, { status: 400 });
    }

    const conn = await getDbConnection();

    const [rows] = await conn.execute(
      `SELECT 
        customer_id,
        first_name,
        last_name,
        phone,
        email,
        status,
        stage,
        lead_campaign,
        date_created,
        assigned_to,
        lead_source,
        sales_representative
       FROM customers
       WHERE DATE(date_created) BETWEEN ? AND ?
       AND (${EMPLOYEE_CASE}) = ?
       ORDER BY date_created DESC`,
      [from, to, employee]
    );

    return NextResponse.json({
      success: true,
      from,
      to,
      employee,
      leads: rows,
    });
  } catch (err) {
    console.error("/api/meta-backfill/leads-report/details error:", err);
    return NextResponse.json(
      { error: "Failed to fetch lead details" },
      { status: 500 }
    );
  }
}
